const cloudinary = require('cloudinary').v2;
const fs = require('fs'); // Uncomment this line to use 'fs'

// Configure Cloudinary with environment variables
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        // Upload the file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "raw"
            // resource_type: "auto"
        });
        
        // Remove the locally stored file
        fs.unlinkSync(localFilePath);
        
        return response; // Return the Cloudinary response (e.g., URL)

    } catch (error) {
        console.error('Error uploading file to Cloudinary:', error);
        fs.unlinkSync(localFilePath); // Remove the local file on error
        return null;
    }
}

// Use module.exports for CommonJS
module.exports = uploadOnCloudinary;
