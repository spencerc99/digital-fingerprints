#!/usr/bin/env sh

# abort on errors
set -e

# build
# npm run build
npx vite build

# navigate into the build output directory
cd dist

# if you are deploying to a custom domain
echo 'www.spencerchang.me' > CNAME

git init
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f https://github.com/spencerc99/digital-fingerprints.git main:public

cd -
