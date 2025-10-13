#!/bin/bash
set -e

# Exit if the replica set is already configured
# This check makes the script idempotent
if [ -f /data/db/mongod.lock ]; then
  echo ">>> MongoDB already configured, starting normally."
  exec mongod --replSet ${MONGO_REPLICA_SET_NAME} --bind_ip_all --keyFile /etc/mongo/mongo.key
fi

# Ensure keyfile has correct permissions
chown mongodb:mongodb /etc/mongo/mongo.key
chmod 400 /etc/mongo/mongo.key

# 1. Start a temporary mongod instance WITH --replSet but WITHOUT auth
echo ">>> Starting temporary MongoDB instance for initialization..."
mongod --replSet ${MONGO_REPLICA_SET_NAME} --bind_ip_all &
MONGO_PID=$!

# 2. Wait for it to be ready
echo ">>> Waiting for MongoDB to become available..."
until mongosh --eval "print('Waited for connection')" > /dev/null 2>&1
do
  sleep 1
done
echo ">>> MongoDB is ready."

# 3. Initiate the replica set
echo ">>> Initiating replica set..."
mongosh --eval "
  rs.initiate({
    _id: '${MONGO_REPLICA_SET_NAME}',
    members: [{ _id: 0, host: 'mongodb:${MONGO_DATABASE_PORT}' }]
  });
"

# 4. Wait for the node to become PRIMARY
echo ">>> Waiting for replica set to elect a primary..."
until mongosh --eval "db.isMaster().ismaster" | grep "true" > /dev/null 2>&1
do
    sleep 1
done
echo ">>> Node is now PRIMARY."

# 5. Create root and application users
# This works because of the localhost exception (connecting without auth from within the container)
echo ">>> Creating root user..."
mongosh --eval "
  db.getSiblingDB('admin').createUser({
    user: '${MONGO_INITDB_ROOT_USERNAME}',
    pwd: '${MONGO_INITDB_ROOT_PASSWORD}',
    roles: [ { role: 'root', db: 'admin' } ]
  })
"

echo ">>> Creating application user..."
mongosh "mongodb://localhost:${MONGO_DATABASE_PORT}/${MONGO_INITDB_DATABASE}" --eval "
  db.createUser({
    user: '${MONGO_BACKEND_USERNAME}',
    pwd: '${MONGO_BACKEND_PASSWORD}',
    roles: [{
      role: 'readWrite',
      db: '${MONGO_INITDB_DATABASE}'
    }]
  })
"

# 6. Shut down the temporary instance
echo ">>> Shutting down temporary MongoDB instance..."
kill $MONGO_PID
wait $MONGO_PID

# 7. Restart the final mongod process with auth enabled
echo ">>> Initialization complete. Restarting MongoDB with authentication..."
exec mongod --replSet ${MONGO_REPLICA_SET_NAME} --bind_ip_all --keyFile /etc/mongo/mongo.key