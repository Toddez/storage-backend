# storage-backend

## Requirements
Requires a mongodb database

## Installation
``npm install``  
Install node modules

## Running
``npm run watch``  
Runs development build while watching for file changes

``npm start``  
Runs bundled server

``npm build``  
Builds server to ``dist/bundle.js`` for production

## Configuration
The following can be configed in an ``.env`` file:
```
HTTP_PORT = port-to-listen-on
JWT_SECRET = secret-jwt-key
HASH_SALT = secret-salt-for-hashing
SESSION_SECRET = secret-session-key
MONGODB_URL = url-for-mongodb-database
MONGODB_NAME = name-of-mongodb-database
CORS_ORIGIN = ["url0", "url1] OR url
```

``ALLOWED_IP = some-ip``  
Can be configured to only allow access from a specific IP

## Features
- ### Authentication using:
  - Private id - used to identify user
  - Private key - used to authenticate user and encrypt data
  - 2 factor authentication
- ### File storage
  - All files are stored fully encrypted in filesystem
  - Supports actions:
    - Writing
    - Reading
    - Renaming
    - Uploading
    - Uploading from URL
