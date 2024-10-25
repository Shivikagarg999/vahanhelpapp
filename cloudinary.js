const cloudinary = require('cloudinary').v2;
const fs = require('fs'); 


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
            resource_type: "auto"
<<<<<<< HEAD
=======
            // resource_type: "auto"
>>>>>>> 013491266ea7429b2dfbe0735b1d2cbf7d34e3c7
        });
       
        fs.unlinkSync(localFilePath);
       
        return response; 

    } catch (error) {
        console.error('Error uploading file to Cloudinary:', error);
        fs.unlinkSync(localFilePath); 
        return null;
    }
}

module.exports = uploadOnCloudinary;
