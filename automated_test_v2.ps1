# VIPOS Automated E2E Test Script v2
# Date: May 9, 2026
# Device: 7XUGPNJZ8LDYQCCA

$DEVICE = "7XUGPNJZ8LDYQCCA"
$PACKAGE = "id.alviarts.vipos.staging"
$ACTIVITY = "id.alviarts.vipos.MainActivity"

# Test results
$script:passed = 0
$script:failed = 0
$script:results = @()

function Log-Test {
    param($name, $status, $message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    $result = [PSCustomObject]@{
        Time = $timestamp
        Test = $name
        Status = $status
        Message = $message
    }
    $script:results += $result
    
    if ($status -eq "PASS") {
        $script:passed++
        Write-Host "[$timestamp] PASS: $name" -ForegroundColor Green
    } else {
        $script:failed++
        Write-Host "[$timestamp] FAIL: $name - $message" -ForegroundColor Red
    }
}

function Wait-Seconds {
    param($seconds)
    Start-Sleep -Seconds $seconds
}

function Tap-Coordinate {
    param($x, $y)
    adb -s $DEVICE shell input tap $x $y | Out-Null
    Wait-Seconds 0.5
}

function Input-Text {
    param($text)
    # Clear any existing text first
    adb -s $DEVICE shell input keyevent KEYCODE_MOVE_END | Out-Null
    for ($i = 0; $i -lt 50; $i++) {
        adb -s $DEVICE shell input keyevent KEYCODE_DEL | Out-Null
    }
    Wait-Seconds 0.3
    adb -s $DEVICE shell input text $text | Out-Null
    Wait-Seconds 0.5
}

function Press-Back {
    adb -s $DEVICE shell input keyevent KEYCODE_BACK | Out-Null
    Wait-Seconds 1
}

function Get-UIText {
    adb -s $DEVICE shell uiautomator dump /sdcard/window_dump.xml 2>&1 | Out-Null
    adb -s $DEVICE pull /sdcard/window_dump.xml . 2>&1 | Out-Null
    $content = Get-Content window_dump.xml -Raw
    return $content
}

function Check-TextExists {
    param($text)
    $dump = Get-UIText
    return $dump -match [regex]::Escape($text)
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VIPOS E2E Automated Test v2" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Clear logcat
Write-Host "Clearing logcat..." -ForegroundColor Yellow
adb -s $DEVICE logcat -c 2>&1 | Out-Null

# Kill app if running
Write-Host "Stopping app..." -ForegroundColor Yellow
adb -s $DEVICE shell am force-stop $PACKAGE 2>&1 | Out-Null
Wait-Seconds 2

# Launch app
Write-Host "Launching app...`n" -ForegroundColor Yellow
adb -s $DEVICE shell am start -n "$PACKAGE/$ACTIVITY" 2>&1 | Out-Null
Wait-Seconds 3

# ========================================
# TEST 1: Login Screen Appears
# ========================================
Write-Host "[TEST 1] Login Screen Appears" -ForegroundColor Cyan
$dump = Get-UIText

if ($dump -match "VIPOS" -and $dump -match "Username" -and $dump -match "Password") {
    Log-Test "Login screen appears" "PASS" "All login UI elements found"
} else {
    Log-Test "Login screen appears" "FAIL" "Login UI not complete"
}

# ========================================
# TEST 2: Login with Valid Credentials
# ========================================
Write-Host "`n[TEST 2] Login with Valid Credentials" -ForegroundColor Cyan

# Tap username field (center of bounds [41,642][679,753])
$usernameX = 360
$usernameY = 697
Write-Host "Tapping username field at ($usernameX, $usernameY)" -ForegroundColor Gray
Tap-Coordinate $usernameX $usernameY

# Input username
Write-Host "Entering username: admin" -ForegroundColor Gray
Input-Text "admin"

# Tap password field (center of bounds [41,780][679,891])
$passwordX = 360
$passwordY = 835
Write-Host "Tapping password field at ($passwordX, $passwordY)" -ForegroundColor Gray
Tap-Coordinate $passwordX $passwordY

# Input password
Write-Host "Entering password: admin123" -ForegroundColor Gray
Input-Text "admin123"

# Tap login button (center of bounds [41,1028][679,1111])
$loginX = 360
$loginY = 1069
Write-Host "Tapping login button at ($loginX, $loginY)" -ForegroundColor Gray
Tap-Coordinate $loginX $loginY

# Wait for navigation
Write-Host "Waiting for login response..." -ForegroundColor Gray
Wait-Seconds 4

# Check if home screen appears
$dump = Get-UIText
if ($dump -match "Reservasi" -or $dump -match "Appointment") {
    Log-Test "Login successful" "PASS" "Home screen detected"
} else {
    # Check for error message
    if ($dump -match "error" -or $dump -match "invalid" -or $dump -match "gagal" -or $dump -match "salah") {
        Log-Test "Login successful" "FAIL" "Error message shown"
    } else {
        Log-Test "Login successful" "FAIL" "Home screen not detected, no error shown"
    }
}

# ========================================
# TEST 3: Home Screen Elements
# ========================================
Write-Host "`n[TEST 3] Home Screen Elements" -ForegroundColor Cyan
Wait-Seconds 1
$dump = Get-UIText

# Check for main feature buttons
if ($dump -match "Reservasi") {
    Log-Test "Reservasi button visible" "PASS" "Found on home screen"
} else {
    Log-Test "Reservasi button visible" "FAIL" "Not found"
}

if ($dump -match "Stok") {
    Log-Test "Inventory button visible" "PASS" "Found on home screen"
} else {
    Log-Test "Inventory button visible" "FAIL" "Not found"
}

if ($dump -match "Opname") {
    Log-Test "Stock Opname button visible" "PASS" "Found on home screen"
} else {
    Log-Test "Stock Opname button visible" "FAIL" "Not found"
}

if ($dump -match "Laporan") {
    Log-Test "Sales Report button visible" "PASS" "Found on home screen"
} else {
    Log-Test "Sales Report button visible" "FAIL" "Not found"
}

if ($dump -match "Karyawan") {
    Log-Test "Employee button visible" "PASS" "Found on home screen"
} else {
    Log-Test "Employee button visible" "FAIL" "Not found"
}

# ========================================
# TEST 4: Navigate to Appointments
# ========================================
Write-Host "`n[TEST 4] Navigate to Appointments" -ForegroundColor Cyan

# Find Reservasi button and tap it
$dump = Get-UIText
if ($dump -match 'text="Reservasi".*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
    $x = ([int]$matches[1] + [int]$matches[3]) / 2
    $y = ([int]$matches[2] + [int]$matches[4]) / 2
    Write-Host "Tapping Reservasi at ($x, $y)" -ForegroundColor Gray
    Tap-Coordinate $x $y
    Wait-Seconds 2
    
    $dump = Get-UIText
    if ($dump -match "Appointment" -or $dump -match "Reservasi") {
        Log-Test "Navigate to Appointments" "PASS" "Appointment screen loaded"
    } else {
        Log-Test "Navigate to Appointments" "FAIL" "Screen not loaded"
    }
    
    Press-Back
} else {
    Log-Test "Navigate to Appointments" "FAIL" "Reservasi button not found"
}

# ========================================
# TEST 5: Navigate to Inventory
# ========================================
Write-Host "`n[TEST 5] Navigate to Inventory" -ForegroundColor Cyan

$dump = Get-UIText
if ($dump -match 'text="Stok Masuk/Keluar".*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
    $x = ([int]$matches[1] + [int]$matches[3]) / 2
    $y = ([int]$matches[2] + [int]$matches[4]) / 2
    Write-Host "Tapping Inventory at ($x, $y)" -ForegroundColor Gray
    Tap-Coordinate $x $y
    Wait-Seconds 2
    
    $dump = Get-UIText
    if ($dump -match "Inventory" -or $dump -match "Movement" -or $dump -match "Stok") {
        Log-Test "Navigate to Inventory" "PASS" "Inventory screen loaded"
    } else {
        Log-Test "Navigate to Inventory" "FAIL" "Screen not loaded"
    }
    
    Press-Back
} else {
    Log-Test "Navigate to Inventory" "FAIL" "Inventory button not found"
}

# ========================================
# TEST 6: Navigate to Stock Opname
# ========================================
Write-Host "`n[TEST 6] Navigate to Stock Opname" -ForegroundColor Cyan

$dump = Get-UIText
if ($dump -match 'text="Stok Opname".*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
    $x = ([int]$matches[1] + [int]$matches[3]) / 2
    $y = ([int]$matches[2] + [int]$matches[4]) / 2
    Write-Host "Tapping Stock Opname at ($x, $y)" -ForegroundColor Gray
    Tap-Coordinate $x $y
    Wait-Seconds 2
    
    $dump = Get-UIText
    if ($dump -match "Opname" -or $dump -match "Physical") {
        Log-Test "Navigate to Stock Opname" "PASS" "Stock Opname screen loaded"
    } else {
        Log-Test "Navigate to Stock Opname" "FAIL" "Screen not loaded"
    }
    
    Press-Back
} else {
    Log-Test "Navigate to Stock Opname" "FAIL" "Stock Opname button not found"
}

# ========================================
# TEST 7: Navigate to Sales Report
# ========================================
Write-Host "`n[TEST 7] Navigate to Sales Report" -ForegroundColor Cyan

$dump = Get-UIText
if ($dump -match 'text="Laporan Penjualan".*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
    $x = ([int]$matches[1] + [int]$matches[3]) / 2
    $y = ([int]$matches[2] + [int]$matches[4]) / 2
    Write-Host "Tapping Sales Report at ($x, $y)" -ForegroundColor Gray
    Tap-Coordinate $x $y
    Wait-Seconds 2
    
    $dump = Get-UIText
    if ($dump -match "Report" -or $dump -match "Laporan" -or $dump -match "Sales") {
        Log-Test "Navigate to Sales Report" "PASS" "Sales Report screen loaded"
    } else {
        Log-Test "Navigate to Sales Report" "FAIL" "Screen not loaded"
    }
    
    Press-Back
} else {
    Log-Test "Navigate to Sales Report" "FAIL" "Sales Report button not found"
}

# ========================================
# TEST 8: Navigate to Employee
# ========================================
Write-Host "`n[TEST 8] Navigate to Employee Management" -ForegroundColor Cyan

$dump = Get-UIText
if ($dump -match 'text="Karyawan".*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
    $x = ([int]$matches[1] + [int]$matches[3]) / 2
    $y = ([int]$matches[2] + [int]$matches[4]) / 2
    Write-Host "Tapping Employee at ($x, $y)" -ForegroundColor Gray
    Tap-Coordinate $x $y
    Wait-Seconds 2
    
    $dump = Get-UIText
    if ($dump -match "Employee" -or $dump -match "Karyawan") {
        Log-Test "Navigate to Employee" "PASS" "Employee screen loaded"
    } else {
        Log-Test "Navigate to Employee" "FAIL" "Screen not loaded"
    }
    
    Press-Back
} else {
    Log-Test "Navigate to Employee" "FAIL" "Employee button not found"
}

# ========================================
# TEST 9: Check for Crashes
# ========================================
Write-Host "`n[TEST 9] Check for Crashes" -ForegroundColor Cyan

$crashes = adb -s $DEVICE logcat -d 2>&1 | Select-String "AndroidRuntime.*FATAL"
if ($crashes) {
    Log-Test "No crashes" "FAIL" "Found crash in logcat"
    Write-Host $crashes -ForegroundColor Red
} else {
    Log-Test "No crashes" "PASS" "No crashes detected"
}

# ========================================
# TEST 10: App Still Running
# ========================================
Write-Host "`n[TEST 10] App Still Running" -ForegroundColor Cyan

$process = adb -s $DEVICE shell "ps -A | grep $PACKAGE" 2>&1
if ($process) {
    Log-Test "App still running" "PASS" "Process found"
} else {
    Log-Test "App still running" "FAIL" "Process not found"
}

# ========================================
# SUMMARY
# ========================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$total = $script:passed + $script:failed
Write-Host "Total Tests: $total" -ForegroundColor White
Write-Host "Passed: $($script:passed)" -ForegroundColor Green
Write-Host "Failed: $($script:failed)" -ForegroundColor Red

if ($total -gt 0) {
    $successRate = [math]::Round($script:passed / $total * 100, 2)
    Write-Host "Success Rate: $successRate%" -ForegroundColor Yellow
}

# Save results to file
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$reportFile = "AUTOMATED_TEST_REPORT_$timestamp.txt"
$script:results | Format-Table -AutoSize | Out-File $reportFile
Write-Host "`nReport saved to: $reportFile" -ForegroundColor Cyan

# Export detailed results
$script:results | Export-Csv "AUTOMATED_TEST_RESULTS_$timestamp.csv" -NoTypeInformation
Write-Host "CSV saved to: AUTOMATED_TEST_RESULTS_$timestamp.csv" -ForegroundColor Cyan

Write-Host "`n========================================`n" -ForegroundColor Cyan
