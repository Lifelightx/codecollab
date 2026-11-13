const Codespace = require('../models/codeSpace');
const User = require('../models/User');

const GUEST_MAX_BYTES = 2 * 1024 * 1024; // 2MB limit for guest spaces
const USER_MAX_BYTES = 200 * 1024 * 1024; // 200MB limit for signed-in user

const initializeSocket = (io) => {
    io.on('connection', (socket) => {
        socket.on('join-space', async ({ spaceName }) => {
            const normalized = spaceName.toLowerCase();
            socket.join(normalized);
            socket.to(normalized).emit('user-joined', { userId: socket.id });
        });

        // Listen for code changes from a client
        socket.on('code-change', async ({ spaceName, file, path, content }) => {
            const normalized = spaceName.toLowerCase();
            socket.to(normalized).emit('code-updated', { file, path: path || '', content });

            try {
                const space = await Codespace.findOne({ name: normalized });
                if (!space) return;

                // Check 2MB size limit for unauthenticated spaces
                if (!space.ownerId) {
                    const currentSize = space.calculateTotalSize();
                    const incomingSize = content ? Buffer.byteLength(content, 'utf8') : 0;
                    if (currentSize + incomingSize > GUEST_MAX_BYTES) {
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
                console.error("DB update failed:", err);
            }
        });

        // Listen for new file creation
        socket.on('create-file', async ({ spaceName, fileName, language, isFolder, path }) => {
            const normalized = spaceName.toLowerCase();
            try {
                const space = await Codespace.findOne({ name: normalized });
                if (!space) return;

                // Gate folders to signed-in owners only
                if (isFolder && !space.ownerId) {
                    socket.emit('auth-required', {
                        message: 'Folder creation is only available for signed-in users. Please sign in.',
                    });
                    return;
                }

                // Check guest 2MB size limit
                if (!space.ownerId && space.calculateTotalSize() >= GUEST_MAX_BYTES) {
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
                    io.to(normalized).emit('file-created', updatedCodespace.files);
                }
            } catch (err) {
                console.error("Create file error:", err);
            }
        });

        // Listen for file/folder deletion
        socket.on('delete-file', async ({ spaceName, fileName, path, isFolder }) => {
            const normalized = spaceName.toLowerCase();
            try {
                const space = await Codespace.findOne({ name: normalized });
                if (!space) return;

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
                    io.to(normalized).emit('file-deleted', { 
                        fileName, 
                        path: targetPath, 
                        isFolder: targetIsFolder, 
                        files: updatedCodespace.files 
                    });
                }
            } catch (err) {
                console.error("Delete file error:", err);
            }
        });

        socket.on('privacy-change', ({ spaceName, isPublic, hasPasscode }) => {
            const normalized = spaceName.toLowerCase();
            socket.to(normalized).emit('privacy-updated', { isPublic, hasPasscode });
        });
    });
};

module.exports = initializeSocket;
