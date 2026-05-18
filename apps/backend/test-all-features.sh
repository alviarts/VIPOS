#!/bin/bash

# VIPOS Feature Testing Script
echo '========================================='
echo 'VIPOS COMPREHENSIVE FEATURE TEST'
echo '========================================='
echo ''

# Get auth token
echo '1. Testing Authentication...'
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | \
  grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo '   ❌ Login failed'
  exit 1
fi
echo '   ✅ Login successful'
echo ''

# Test all new endpoints
echo '2. Testing New API Endpoints...'

endpoints=(
  'recipes:Product Recipes'
  'transfers:Inter-outlet Transfers'
  'production:Production Management'
  'bundles:Product Bundles'
  'batches:Batch Tracking'
  'serials:Serial Tracking'
  'time-prices:Time-based Pricing'
  'budgets:Budget Planning'
  'bank-reconciliation:Bank Reconciliation'
  'warehouses:Multi-warehouse'
)

for endpoint in "\; do
 IFS=':' read -r path name <<< "$endpoint"
 response=$(curl -s -w "\\n%{http_code}" http://localhost:3001/api/v1/$path \
 -H "Authorization: Bearer $TOKEN")
 http_code=$(echo "$response" | tail -n1)
 
 if [ "$http_code" = "200" ]; then
 echo " ✅ $name ($path)"
 else
 echo " ❌ $name ($path) - HTTP $http_code"
 fi
done

echo ''
echo '3. Testing Core Endpoints...'

core_endpoints=(
 'products:Products'
 'categories:Categories'
 'customers:Customers'
 'transactions:Transactions'
)

for endpoint in "\; do
  IFS=':' read -r path name <<< "$endpoint"
  response=$(curl -s -w "\\n%{http_code}" http://localhost:3001/api/v1/$path \
    -H "Authorization: Bearer $TOKEN")
  http_code=$(echo "$response" | tail -n1)
  
  if [ "$http_code" = "200" ]; then
    echo "   ✅ $name ($path)"
  else
    echo "   ❌ $name ($path) - HTTP $http_code"
  fi
done

echo ''
echo '========================================='
echo 'TEST COMPLETE'
echo '========================================='
