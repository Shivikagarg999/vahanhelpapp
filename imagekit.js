const ImageKit = require('imagekit');
const fs = require('fs');

// Configure ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const uploadOnImageKit = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        // Convert file to base64 if necessary
        const fileData = fs.readFileSync(localFilePath, { encoding: 'base64' });

        // Upload to ImageKit
        const response = await imagekit.upload({
            file: fileData, // Required: base64 or Buffer for ImageKit
            fileName: localFilePath.split('/').pop(),
            folder: "/uploads" // Optional: specify a folder if needed
        });

        // Delete the local file after upload
        fs.unlinkSync(localFilePath);

        return response;

    } catch (error) {
        console.error('Error uploading file to ImageKit:', error);
        fs.unlinkSync(localFilePath); // Ensure local file cleanup
        return null;
    }
};

module.exports = uploadOnImageKit;
