#!/bin/bash
set -e

mongosh -- <<EOF
  use ${MONGO_INITDB_DATABASE}
  db.createUser({
    user: '${MONGO_BACKEND_USERNAME}',
    pwd: '${MONGO_BACKEND_PASSWORD}',
    roles: [{
      role: 'readWrite',
      db: '${MONGO_INITDB_DATABASE}'
    }]
  })
EOF
