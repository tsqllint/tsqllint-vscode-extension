#!/bin/bash

version=$1

sed -E -i .bak "s/\"version\": \"([0-9]+\.){2}[0-9]+\"/\"version\": \"$version\"/g" ./package.json
sed -E -i .bak "s/\"version\": \"([0-9]+\.){2}[0-9]+\"/\"version\": \"$version\"/g" ./client/package.json
sed -E -i .bak "s/\"version\": \"([0-9]+\.){2}[0-9]+\"/\"version\": \"$version\"/g" ./server/package.json

find . -name "*.json.bak" -type f -delete
