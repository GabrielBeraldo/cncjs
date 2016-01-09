#!/bin/bash

echo "TRAVIS_BRANCH=$TRAVIS_BRANCH"
echo "TRAVIS_BUILD_NUMBER=$TRAVIS_BUILD_NUMBER"
echo "TRAVIS_COMMIT=$TRAVIS_COMMIT"
echo "TRAVIS_TAG=$TRAVIS_TAG"

NODE_VERSION=`node --version`
DOCKER_REPO=cheton/cnc
DOCKER_BUILD_TAG=travis-$TRAVIS_BUILD_NUMBER.${TRAVIS_COMMIT::8}
DOCKER_BRANCH_TAG=`if [ "$TRAVIS_BRANCH" == "master" ]; then echo -n "latest"; else echo -n "$TRAVIS_BRANCH"; fi`

if [ "${NODE_VERSION::2}" == "v5" ]; then
    echo "DOCKER_REPO=$DOCKER_REPO"
    echo "DOCKER_BUILD_TAG=$DOCKER_BUILD_TAG"
    echo "DOCKER_BRANCH_TAG=$DOCKER_BRANCH_TAG"
    docker login -e $DOCKER_EMAIL -u $DOCKER_USER -p $DOCKER_PASS
    docker build -f Dockerfile -t $DOCKER_REPO:$DOCKER_BUILD_TAG .
    docker tag $DOCKER_REPO:$DOCKER_BUILD_TAG $DOCKER_REPO:$DOCKER_BRANCH_TAG
    if [ ! -z "$TRAVIS_TAG" ]; then
        docker tag -f $DOCKER_REPO:$DOCKER_BUILD_TAG $DOCKER_REPO:$TRAVIS_TAG;
    fi
    docker images
    docker push $DOCKER_REPO
fi
