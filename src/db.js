const mongodb = require('mongodb');

const url = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_NAME || 'storage';

class Database {
    static async connect() {
        await new Promise(resolve => {
            mongodb.MongoClient.connect(
                url,
                {
                    useUnifiedTopology: true
                },
                (err, client) => {
                    if (err)
                        return;

                    if (!Database.clients)
                        Database.clients = [];

                    Database.clients.push(client);
                    resolve();
                }
            );
        });

        return Database;
    }

    static collection(collection) {
        if (Database.clients.length < 1)
            return;

        return Database.clients[0].db(dbName).collection(collection);
    }
}

export default Database;
