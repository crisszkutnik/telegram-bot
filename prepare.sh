#!/bin/bash
git clone --branch expenses-save-api-v1.1.1 --depth 1 https://github.com/crisszkutnik/k8s-cluster-apps.git
cp -r k8s-cluster-apps/expenses-save-api/proto .
rm -rf k8s-cluster-apps