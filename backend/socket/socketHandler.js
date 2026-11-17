const Codespace = require('../models/codeSpace');
const User = require('../models/User');
const logger = require('../utils/logger');
const { websocketConnectedClients, websocketEventsCounter } = require('../utils/metrics');

const GUEST_MAX_BYTES = 2 * 1024 * 1024; // 2MB limit for guest spaces
const USER_MAX_BYTES = 200 * 1024 * 1024; // 200MB limit for signed-in user

const initializeSocket = (io) => {
    io.on('connection', (socket) => {
        websocketConnectedClients.inc();
        logger.info(`Client connected: ${socket.id} [IP: ${socket.handshake.address || 'unknown'}]`, null, 'SOCKET');

        socket.on('disconnect', (reason) => {
            websocketConnectedClients.dec();
            logger.info(`Client disconnected: ${socket.id} (Reason: ${reason})`, null, 'SOCKET');
        });

        socket.on('join-space', async ({ spaceName }) => {
            websocketEventsCounter.inc({ event: 'join-space' });
            if (!spaceName) return;
            const normalized = spaceName.toLowerCase();
            socket.join(normalized);
            logger.info(`Client ${socket.id} joined space: '${normalized}'`, null, 'SOCKET');
            socket.to(normalized).emit('user-joined', { userId: socket.id });
        });

        // Listen for code changes from a client
        socket.on('code-change', async ({ spaceName, file, path, content }) => {
            websocketEventsCounter.inc({ event: 'code-change' });
            if (!spaceName || !file) return;
            const normalized = spaceName.toLowerCase();
            socket.to(normalized).emit('code-updated', { file, path: path || '', content });

            try {
                const space = await Codespace.findOne({ name: normalized });
                if (!space) {
                    logger.warn(`code-change: Codespace not found: '${normalized}'`, null, 'SOCKET');
                    return;
                }

                // Check 2MB size limit for unauthenticated spaces
                if (!space.ownerId) {
                    const currentSize = space.calculateTotalSize();
                    const incomingSize = content ? Buffer.byteLength(content, 'utf8') : 0;
                    if (currentSize + incomingSize > GUEST_MAX_BYTES) {
                        logger.warn(`Guest space '${normalized}' reached 2MB size limit`, null, 'SOCKET');
                        socket.emit('space-limit-exceeded', {
                            message: 'This guest codespace has reached the 2MB size limit. Sign in to unlock up to 200MB!',
                        });
                        return;
                    }
                }

                if (path !== undefined) {
                    const updateRes = await Codespace.updateOne(
                        { name: normalized, files: { $elemMatch: { name: file, path: path || '' } } },
                        { $set: { 'files.$.content': content } }
                    );
                    if (updateRes.matchedCount > 0) return;
                }

                await Codespace.updateOne(
                    { name: normalized, 'files.name': file },
                    { $set: { 'files.$.content': content } }
                );
            } catch (err) {
                logger.error(`DB update failed on code-change in '${normalized}' for '${file}': ${err.message}`, err, 'SOCKET');
            }
        });

        // Listen for new file creation
        socket.on('create-file', async ({ spaceName, fileName, language, isFolder, path }) => {
            websocketEventsCounter.inc({ event: 'create-file' });
            if (!spaceName || !fileName) return;
            const normalized = spaceName.toLowerCase();
            try {
                const space = await Codespace.findOne({ name: normalized });
                if (!space) {
                    logger.warn(`create-file: Codespace not found: '${normalized}'`, null, 'SOCKET');
                    return;
                }

                // Gate folders to signed-in owners only
                if (isFolder && !space.ownerId) {
                    logger.warn(`Folder creation blocked in guest space '${normalized}'`, null, 'SOCKET');
                    socket.emit('auth-required', {
                        message: 'Folder creation is only available for signed-in users. Please sign in.',
                    });
                    return;
                }

                // Check guest 2MB size limit
                if (!space.ownerId && space.calculateTotalSize() >= GUEST_MAX_BYTES) {
                    logger.warn(`File creation blocked: guest space '${normalized}' exceeds 2MB`, null, 'SOCKET');
                    socket.emit('space-limit-exceeded', {
                        message: 'Guest spaces cannot exceed 2MB. Sign in to continue.',
                    });
                    return;
                }

                const newFile = { 
                    name: fileName, 
                    language: language || 'plaintext', 
                    content: '',
                    isFolder: !!isFolder,
                    path: path || '',
                };

                const updatedCodespace = await Codespace.findOneAndUpdate(
                    { name: normalized },
                    { $push: { files: newFile } },
                    { new: true }
                );

                if (updatedCodespace) {
                    logger.info(
                        `Created ${isFolder ? 'folder' : 'file'} '${fileName}' in '${normalized}' [Path: '${path || ''}']`,
                        null,
                        'SOCKET'
                    );
                    io.to(normalized).emit('file-created', updatedCodespace.files);
                }
            } catch (err) {
                logger.error(`Create file error in '${normalized}' for '${fileName}': ${err.message}`, err, 'SOCKET');
            }
        });

        // Listen for file/folder deletion
        socket.on('delete-file', async ({ spaceName, fileName, path, isFolder }) => {
            websocketEventsCounter.inc({ event: 'delete-file' });
            if (!spaceName || !fileName) return;
            const normalized = spaceName.toLowerCase();
            try {
                const space = await Codespace.findOne({ name: normalized });
                if (!space) {
                    logger.warn(`delete-file: Codespace not found: '${normalized}'`, null, 'SOCKET');
                    return;
                }

                const target = space.files.find(f => 
                    f.name === fileName && (path === undefined || (f.path || '') === (path || ''))
                );
                const targetIsFolder = isFolder ?? target?.isFolder ?? false;
                const targetPath = (target && target.path !== undefined) ? target.path : (path || '');

                let pullCondition;
                if (targetIsFolder) {
                    const folderFullPath = targetPath ? `${targetPath}/${fileName}` : fileName;
                    pullCondition = {
                        $or: [
                            { name: fileName, isFolder: true, path: targetPath },
                            { path: folderFullPath },
                            { path: new RegExp(`^${folderFullPath}/`) }
                        ]
                    };
                } else {
                    pullCondition = { name: fileName, path: targetPath };
                }

                const updatedCodespace = await Codespace.findOneAndUpdate(
                    { name: normalized },
                    { $pull: { files: pullCondition } },
                    { new: true }
                );

                if (updatedCodespace) {
                    logger.info(
                        `Deleted ${targetIsFolder ? 'folder' : 'file'} '${fileName}' in '${normalized}'`,
                        null,
                        'SOCKET'
                    );
                    io.to(normalized).emit('file-deleted', { 
                        fileName, 
                        path: targetPath, 
                        isFolder: targetIsFolder, 
                        files: updatedCodespace.files 
                    });
                }
            } catch (err) {
                logger.error(`Delete file error in '${normalized}' for '${fileName}': ${err.message}`, err, 'SOCKET');
            }
        });

        socket.on('privacy-change', ({ spaceName, isPublic, hasPasscode }) => {
            websocketEventsCounter.inc({ event: 'privacy-change' });
            if (!spaceName) return;
            const normalized = spaceName.toLowerCase();
            logger.info(`Privacy updated in '${normalized}': isPublic=${isPublic}, hasPasscode=${!!hasPasscode}`, null, 'SOCKET');
            socket.to(normalized).emit('privacy-updated', { isPublic, hasPasscode });
        });
    });
};

module.exports = initializeSocket;
