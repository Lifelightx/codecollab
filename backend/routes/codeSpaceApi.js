const express = require('express');
const Codespace = require('../models/codeSpace');
const User = require('../models/User');
const { optionalAuth, requireAuth } = require('../middleware/auth');

module.exports = (io) => {
    const router = express.Router();

    // Helper: 3-day retention for guest, 60-day for authenticated
    const getExpirationDate = (isAuthenticated) => {
        const days = isAuthenticated ? 60 : 3;
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    };

    // Get or Create a Codespace (with optionalAuth to set owner and 60d vs 3d retention)
    router.post('/', optionalAuth, async (req, res) => {
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
                return res.json(codespace);
            } else {
                const isAuth = !!req.user;
                const newCodespace = new Codespace({
                    name: sanitizedName,
                    ownerId: isAuth ? req.user.id : null,
                    expiresAt: getExpirationDate(isAuth),
                    files: [{ 
                        name: 'index.html', 
                        language: 'html', 
                        content: '<h1>Welcome to your new CodeSpace!</h1>',
                        isFolder: false,
                        path: '',
                    }]
                });
                await newCodespace.save();
                return res.status(201).json(newCodespace);
            }
        } catch (error) {
            console.error('Create space error:', error);
            res.status(500).json({ msg: 'Server error', error });
        }
    });

    router.get('/:name', async (req, res) => {
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

    router.post('/:name/verify', async (req, res) => {
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

    router.patch('/:name/privacy', async (req, res) => {
        const { name } = req.params;
        const { isPublic, passcode } = req.body;

        try {
            const updatedCodespace = await Codespace.findOneAndUpdate(
                { name: name.toLowerCase() },
                { $set: { isPublic, passcode } },
                { new: true }
            );

            if (!updatedCodespace) {
                return res.status(404).json({ msg: 'Codespace not found' });
            }

            res.json({
                isPublic: updatedCodespace.isPublic,
                hasPasscode: !!updatedCodespace.passcode,
            });
        } catch (error) {
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

            res.json({ message: 'Custom URL updated successfully', customSlug: codespace.customSlug });
        } catch (err) {
            console.error('Custom slug error:', err);
            res.status(500).json({ message: 'Failed to set custom URL' });
        }
    });

    router.get('/:name/status', async (req, res) => {
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

    router.post('/:name/data', async (req, res) => {
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

    router.delete("/:name/delete", async (req, res) => {
        const { file } = req.body;

        try {
            const codespace = await Codespace.findOneAndUpdate(
                { name: req.params.name.toLowerCase() },
                {
                    $pull: {
                        files: { name: file }
                    }
                },
                { new: true }
            );

            if (!codespace) {
                return res.status(404).json({ msg: "Codespace not found." });
            }

            io.to(req.params.name.toLowerCase()).emit('file-deleted', { fileName: file, files: codespace.files });

            return res.json({
                msg: `File '${file}' deleted successfully`,
                codespace
            });

        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    return router;
};
