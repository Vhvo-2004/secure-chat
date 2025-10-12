#!/bin/sh
# set -e

/root/run.sh mongod --bind_ip 0.0.0.0 &
MONGO_PID=$!

sleep 5

echo "Waiting for MongoDB to be ready..."
until nc -z localhost "$MONGO_DATABASE_PORT"; do
  sleep 1
done

echo "Checking if admin user exists..."

admin_exists=$(mongo --quiet admin --eval "print(db.getUsers({filter: {user: '${MONGO_INITDB_ROOT_USERNAME}'}}).length)")

if [ "$admin_exists" -eq "0" ]; then
  echo "Admin user does not exist. Creating..."
  mongo admin --eval "
      db.createUser({
      user: '${MONGO_INITDB_ROOT_USERNAME}',
      pwd: '${MONGO_INITDB_ROOT_PASSWORD}',
      roles: [ { role: 'root', db: 'admin' } ]
    });
    print('Administrative user created successfully!');
  "
  if [ $? -ne 0 ]; then
    echo "Error creating user. Exiting."
    exit 1
  fi
else
  echo "Admin user already exists. Skipping creation."
fi

echo "Checking if backend user exists..."

user_exists=$(mongo --quiet $MONGO_INITDB_DATABASE --eval "print(db.getUsers({filter: {user: '${MONGO_BACKEND_USERNAME}'}}).length)")

if [ "$user_exists" -eq "0" ]; then
  echo "Backend user does not exist. Creating..."
  mongo "${MONGO_INITDB_DATABASE}" --eval "
      db.createUser({
      user: '${MONGO_BACKEND_USERNAME}',
      pwd: '${MONGO_BACKEND_PASSWORD}',
      roles: [ { role: 'readWrite', db: '${MONGO_INITDB_DATABASE}' } ]
    });
    print('Backend user created successfully!');
  "
  if [ $? -ne 0 ]; then
    echo "Error creating user. Exiting."
    exit 1
  fi
else
  echo "Backend user already exists. Skipping creation."
fi

# mongo admin --eval "db.shutdownServer()" # Lógica para exigir autenticação

# wait $MONGO_PID

# /root/run.sh mongod --auth --bind_ip 0.0.0.0 &
# MONGO_PID=$!

# echo "Waiting for MongoDB to be ready for auth..."
# until nc -z localhost "$MONGO_DATABASE_PORT"; do
#   sleep 1
# done

wait "$MONGO_PID"