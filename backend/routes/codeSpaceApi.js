const express = require('express');
const Codespace = require('../models/codeSpace');
const User = require('../models/User');
const logger = require('../utils/logger');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { recordAuditEvent, getClientIp } = require('../utils/auditLogger');

module.exports = (io) => {
    const router = express.Router();

    // Guard: 'admin' space is permanently restricted to admin role
    const verifyAdminSpaceGuard = (req, res, next) => {
        const spaceName = (req.params.name || req.body.name || req.body.spaceName || '').toLowerCase().trim();
        if (spaceName === 'admin') {
            const isAdmin = req.user && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');
            if (!isAdmin) {
                logger.warn(`Unauthorized attempt to access 'admin' space [IP: ${getClientIp(req)}]`, null, 'ACCESS');
                return res.status(403).json({ msg: "Access denied. The 'admin' space is private to the administrator." });
            }
        }
        next();
    };

    // Helper: 3-day retention for guest, 60-day for authenticated
    const getExpirationDate = (isAuthenticated) => {
        const days = isAuthenticated ? 60 : 3;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    };

    // Get or Create a Codespace (with optionalAuth to set owner and 60d vs 3d retention)
    router.post('/', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ msg: 'Codespace name is required' });
        }

        const sanitizedName = name.trim().toLowerCase();

        try {
            let codespace = await Codespace.findOne({ name: sanitizedName });

            if (codespace) {
                // If an authenticated user accesses their space, refresh retention by 60 days
                if (req.user) {
                    if (!codespace.ownerId) {
                        // Claim unowned guest space
                        codespace.ownerId = req.user.id;
                    }
                    if (codespace.ownerId.toString() === req.user.id) {
                        codespace.expiresAt = getExpirationDate(true);
                        await codespace.save();
                    }
                }
                logger.info(`Codespace accessed: '${sanitizedName}' [Owner: ${codespace.ownerId ? codespace.ownerId : 'Guest'}]`, null, 'CODESPACE');
                return res.json(codespace);
            } else {
                const isAuth = !!req.user;
                const isAdmin = isAuth && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');
                const isLifetime = sanitizedName === 'admin' || isAdmin;
                const newCodespace = new Codespace({
                    name: sanitizedName,
                    ownerId: isAuth ? req.user.id : null,
                    isPublic: sanitizedName === 'admin' ? false : true,
                    expiresAt: isLifetime ? new Date('2099-12-31T23:59:59Z') : getExpirationDate(isAuth),
                    files: [{ 
                        name: 'index.html', 
                        language: 'html', 
                        content: '<h1>Welcome to your new CodeSpace!</h1>',
                        isFolder: false,
                        path: '',
                    }]
                });
                await newCodespace.save();
                logger.info(`New Codespace created: '${sanitizedName}' [Auth: ${isAuth}]`, null, 'CODESPACE');
                return res.status(201).json(newCodespace);
            }
        } catch (error) {
            logger.error(`Create space error for '${req.body?.name}': ${error.message}`, error, 'CODESPACE');
            res.status(500).json({ msg: 'Server error', error });
        }
    });

    router.get('/:name', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        try {
            const codespace = await Codespace.findOne({ 
                $or: [{ name: req.params.name.toLowerCase() }, { customSlug: req.params.name.toLowerCase() }]
            });
            if (!codespace) {
                return res.status(404).json({ msg: 'Codespace not found.' });
            }
            res.json(codespace);
        } catch (error) {
            res.status(500).json({ msg: 'Server Error' });
        }
    });

    router.post('/:name/verify', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        const { passcode } = req.body;
        try {
            const codespace = await Codespace.findOne({ name: req.params.name.toLowerCase() });

            if (!codespace) {
                return res.status(404).json({ success: false, message: 'Codespace not found.' });
            }

            if (codespace.passcode === passcode) {
                res.json({ success: true });
            } else {
                res.status(401).json({ success: false, message: 'Incorrect passcode.' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Server Error' });
        }
    });

    router.patch('/:name/privacy', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        const { name } = req.params;
        const { isPublic, passcode } = req.body;

        if (name.toLowerCase() === 'admin') {
            return res.status(400).json({ msg: "The 'admin' space cannot be made public. It is permanently private." });
        }

        try {
            const updatedCodespace = await Codespace.findOneAndUpdate(
                { name: name.toLowerCase() },
                { $set: { isPublic, passcode } },
                { new: true }
            );

            if (!updatedCodespace) {
                return res.status(404).json({ msg: 'Codespace not found' });
            }

            logger.info(`Privacy updated for '${name}': isPublic=${updatedCodespace.isPublic}, hasPasscode=${!!updatedCodespace.passcode}`, null, 'CODESPACE');

            res.json({
                isPublic: updatedCodespace.isPublic,
                hasPasscode: !!updatedCodespace.passcode,
            });
        } catch (error) {
            logger.error(`Update privacy error for '${req.params.name}': ${error.message}`, error, 'CODESPACE');
            res.status(500).json({ msg: 'Server error', error });
        }
    });
            logger.error(`Update privacy error for '${req.params.name}': ${error.message}`, error, 'CODESPACE');
            res.status(500).json({ msg: 'Server error', error });
        }
    });

    // Custom Slug (Vanity URL) endpoint - Authenticated only
    router.post('/:name/custom-slug', requireAuth, async (req, res) => {
        const { slug } = req.body;
        const spaceName = req.params.name.toLowerCase();

        if (!slug || !/^[a-z0-9_-]{3,30}$/i.test(slug)) {
            return res.status(400).json({ message: 'Custom slug must be 3-30 letters, numbers, hyphens or underscores.' });
        }

        try {
            const codespace = await Codespace.findOne({ name: spaceName });
            if (!codespace) return res.status(404).json({ message: 'Codespace not found' });

            // Check if slug taken by another space
            const existingSlug = await Codespace.findOne({ customSlug: slug.toLowerCase(), name: { $ne: spaceName } });
            if (existingSlug) {
                return res.status(400).json({ message: 'This custom URL is already in use.' });
            }

            codespace.customSlug = slug.toLowerCase();
            await codespace.save();

            logger.info(`Custom slug updated for '${spaceName}' -> '${codespace.customSlug}'`, null, 'CODESPACE');

            res.json({ message: 'Custom URL updated successfully', customSlug: codespace.customSlug });
        } catch (err) {
            logger.error(`Custom slug error for '${req.params.name}': ${err.message}`, err, 'CODESPACE');
            res.status(500).json({ message: 'Failed to set custom URL' });
        }
    });

    router.get('/:name/status', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        try {
            const codespace = await Codespace.findOne({ 
                $or: [{ name: req.params.name.toLowerCase() }, { customSlug: req.params.name.toLowerCase() }]
            }).select('name isPublic expiresAt ownerId customSlug');
            if (!codespace) {
                return res.status(404).json({ msg: 'Codespace not found.' });
            }
            res.json({ 
                name: codespace.name,
                isPublic: codespace.isPublic,
                expiresAt: codespace.expiresAt,
                isOwner: !!codespace.ownerId,
                customSlug: codespace.customSlug,
            });
        } catch (error) {
            res.status(500).json({ msg: 'Server Error' });
        }
    });

    router.post('/:name/data', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        const { passcode } = req.body;

        try {
            const codespace = await Codespace.findOne({ 
                $or: [{ name: req.params.name.toLowerCase() }, { customSlug: req.params.name.toLowerCase() }]
            });
            if (!codespace) {
                return res.status(404).json({ msg: 'Codespace not found.' });
            }

            if (codespace.isPublic || codespace.passcode === passcode) {
                return res.json(codespace);
            } else {
                return res.status(401).json({ msg: 'Incorrect passcode.' });
            }
        } catch (error) {
            res.status(500).json({ msg: 'Server Error' });
        }
    });

    // Save or update file from CLI / API
    router.post('/:name/file', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        const { fileName, path = '', content = '', language = 'plaintext' } = req.body;
        if (!fileName) {
            return res.status(400).json({ msg: 'fileName is required' });
        }

        try {
            const spaceName = req.params.name.toLowerCase();
            let space = await Codespace.findOne({ name: spaceName });

            if (!space) {
                // Auto create space if doesn't exist
                const isAuth = !!req.user;
                const isAdmin = isAuth && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');
                space = new Codespace({
                    name: spaceName,
                    ownerId: isAuth ? req.user.id : null,
                    expiresAt: (spaceName === 'admin' || isAdmin) ? new Date('2099-12-31T23:59:59Z') : getExpirationDate(isAuth),
                    files: []
                });
            }

            const existingIndex = space.files.findIndex(f => 
                f.name.toLowerCase() === fileName.toLowerCase() && (f.path || '') === (path || '')
            );

            if (existingIndex >= 0) {
                space.files[existingIndex].content = content;
                space.files[existingIndex].language = language || space.files[existingIndex].language;
                await space.save();
                io.to(spaceName).emit('code-updated', { file: fileName, path, content });
            } else {
                space.files.push({
                    name: fileName,
                    language,
                    content,
                    isFolder: false,
                    path
                });
                await space.save();
                io.to(spaceName).emit('file-created', space.files);

                // Audit log & self alert for new file
                recordAuditEvent({
                    action: 'FILE_CREATED',
                    actor: req.user,
                    ip: getClientIp(req),
                    spaceName,
                    details: `File: '${fileName}' [Path: '${path || '/'}'] [Lang: '${language || 'plaintext'}']`,
                });
            }

            logger.info(`File '${fileName}' saved via CLI in '${spaceName}'`, null, 'CODESPACE');
            res.json({ msg: 'File saved successfully', files: space.files });
        } catch (err) {
            logger.error(`Save file error in '${req.params.name}': ${err.message}`, err, 'CODESPACE');
            res.status(500).json({ message: err.message });
        }
    });

    // Create folder via CLI / API
    router.post('/:name/folder', optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        const { folderName, path = '' } = req.body;
        if (!folderName) {
            return res.status(400).json({ msg: 'folderName is required' });
        }

        try {
            const spaceName = req.params.name.toLowerCase();
            let space = await Codespace.findOne({ name: spaceName });
            if (!space) {
                const isAuth = !!req.user;
                const isAdmin = isAuth && (req.user.role === 'admin' || req.user.username?.toLowerCase() === 'admin');
                space = new Codespace({
                    name: spaceName,
                    ownerId: isAuth ? req.user.id : null,
                    expiresAt: (spaceName === 'admin' || isAdmin) ? new Date('2099-12-31T23:59:59Z') : getExpirationDate(isAuth),
                    files: []
                });
            }

            const cleanPath = (path || '').replace(/^\/+|\/+$/g, '');
            const exists = space.files.some(f => 
                f.isFolder && f.name.toLowerCase() === folderName.toLowerCase() && (f.path || '') === cleanPath
            );

            if (!exists) {
                space.files.push({
                    name: folderName,
                    language: 'folder',
                    content: '',
                    isFolder: true,
                    path: cleanPath
                });
                await space.save();
                io.to(spaceName).emit('file-created', space.files);

                // Audit log & self alert for new folder
                recordAuditEvent({
                    action: 'FILE_CREATED',
                    actor: req.user,
                    ip: getClientIp(req),
                    spaceName,
                    details: `Folder: '${folderName}' [Path: '${cleanPath || '/'}']`,
                });
            }

            logger.info(`Folder '${folderName}' created in '${spaceName}' [Path: '${cleanPath}']`, null, 'CODESPACE');
            res.json({ msg: 'Folder created successfully', files: space.files });
        } catch (err) {
            logger.error(`Create folder error in '${req.params.name}': ${err.message}`, err, 'CODESPACE');
            res.status(500).json({ message: err.message });
        }
    });

    router.delete("/:name/delete", optionalAuth, verifyAdminSpaceGuard, async (req, res) => {
        const { file, path, isFolder } = req.body;

        try {
            const spaceName = req.params.name.toLowerCase();
            const space = await Codespace.findOne({ name: spaceName });
            if (!space) {
                return res.status(404).json({ msg: "Codespace not found." });
            }

            const target = space.files.find(f => 
                f.name === file && (path === undefined || (f.path || '') === (path || ''))
            );
            const targetIsFolder = isFolder ?? target?.isFolder ?? false;
            const targetPath = (target && target.path !== undefined) ? target.path : (path || '');

            let pullCondition;
            if (targetIsFolder) {
                const folderFullPath = targetPath ? `${targetPath}/${file}` : file;
                pullCondition = {
                    $or: [
                        { name: file, isFolder: true, path: targetPath },
                        { path: folderFullPath },
                        { path: new RegExp(`^${folderFullPath}/`) }
                    ]
                };
            } else {
                pullCondition = { name: file, path: targetPath };
            }

            const codespace = await Codespace.findOneAndUpdate(
                { name: spaceName },
                { $pull: { files: pullCondition } },
                { new: true }
            );

            io.to(spaceName).emit('file-deleted', { 
                fileName: file, 
                path: targetPath, 
                isFolder: targetIsFolder, 
                files: codespace.files 
            });

            // Audit log & self alert for deleted file
            recordAuditEvent({
                action: 'FILE_DELETED',
                actor: req.user,
                ip: getClientIp(req),
                spaceName,
                details: `${targetIsFolder ? 'Folder' : 'File'}: '${file}' [Path: '${targetPath || '/'}']`,
            });

            logger.info(`Deleted ${targetIsFolder ? 'folder' : 'file'} '${file}' from codespace '${spaceName}'`, null, 'CODESPACE');

            return res.json({
                msg: `File '${file}' deleted successfully`,
                codespace
            });

        } catch (err) {
            logger.error(`Delete file error in codespace '${req.params.name}' for '${req.body?.file}': ${err.message}`, err, 'CODESPACE');
            res.status(500).json({ message: err.message });
        }
    });

    return router;
};
