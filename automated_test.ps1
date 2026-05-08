# VIPOS Automated E2E Test Script
# Date: May 9, 2026
# Device: 7XUGPNJZ8LDYQCCA

$DEVICE = "7XUGPNJZ8LDYQCCA"
$PACKAGE = "id.alviarts.vipos.staging"
$ACTIVITY = "id.alviarts.vipos.MainActivity"

# Test results
$results = @()
$passed = 0
$failed = 0

function Log-Test {
    param($name, $status, $message)
    $timestamp = Get-Date -Format "HH:mm:ss"
    $result = [PSCustomObject]@{
        Time = $timestamp
        Test = $name
        Status = $status
        Message = $message
    }
    $results += $result
    
    if ($status -eq "PASS") {
        $passed++
        Write-Host "[$timestamp] PASS: $name" -ForegroundColor Green
    } else {
        $failed++
        Write-Host "[$timestamp] FAIL: $name - $message" -ForegroundColor Red
    }
}

function Wait-Seconds {
    param($seconds)
    Start-Sleep -Seconds $seconds
}

function Tap-Coordinate {
    param($x, $y)
    adb -s $DEVICE shell input tap $x $y
    Wait-Seconds 1
}

function Input-Text {
    param($text)
    adb -s $DEVICE shell input text $text
    Wait-Seconds 0.5
}

function Press-Back {
    adb -s $DEVICE shell input keyevent KEYCODE_BACK
    Wait-Seconds 1
}

function Get-ScreenDump {
    return adb -s $DEVICE shell uiautomator dump /dev/tty 2>&1 | Out-String
}

function Check-TextExists {
    param($text)
    $dump = Get-ScreenDump
    return $dump -match [regex]::Escape($text)
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VIPOS E2E Automated Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Clear logcat
Write-Host "Clearing logcat..." -ForegroundColor Yellow
adb -s $DEVICE logcat -c

# Kill app if running
Write-Host "Stopping app..." -ForegroundColor Yellow
adb -s $DEVICE shell am force-stop $PACKAGE
Wait-Seconds 2

# Launch app
Write-Host "Launching app..." -ForegroundColor Yellow
adb -s $DEVICE shell am start -n "$PACKAGE/$ACTIVITY"
Wait-Seconds 3

# ========================================
# TEST 1: Login Screen Appears
# ========================================
Write-Host "`n[TEST 1] Login Screen Appears" -ForegroundColor Cyan
Wait-Seconds 2
$dump = Get-ScreenDump

if ($dump -match "Login" -or $dump -match "Username" -or $dump -match "Password") {
    Log-Test "Login screen appears" "PASS" "Login UI detected"
} else {
    Log-Test "Login screen appears" "FAIL" "Login UI not found"
}

# ========================================
# TEST 2: Login with Valid Credentials
# ========================================
Write-Host "`n[TEST 2] Login with Valid Credentials" -ForegroundColor Cyan

# Get screen size for coordinate calculation
$screenSize = adb -s $DEVICE shell wm size | Select-String "Physical size"
if ($screenSize -match "(\d+)x(\d+)") {
    $screenWidth = [int]$matches[1]
    $screenHeight = [int]$matches[2]
    Write-Host "Screen size: ${screenWidth}x${screenHeight}" -ForegroundColor Gray
    
    # Tap username field (approximate center-top)
    $usernameX = $screenWidth / 2
    $usernameY = $screenHeight * 0.35
    Write-Host "Tapping username field at ($usernameX, $usernameY)" -ForegroundColor Gray
    Tap-Coordinate $usernameX $usernameY
    
    # Input username
    Write-Host "Entering username: admin" -ForegroundColor Gray
    Input-Text "admin"
    
    # Tap password field
    $passwordY = $screenHeight * 0.45
    Write-Host "Tapping password field at ($usernameX, $passwordY)" -ForegroundColor Gray
    Tap-Coordinate $usernameX $passwordY
    
    # Input password
    Write-Host "Entering password: admin123" -ForegroundColor Gray
    Input-Text "admin123"
    
    # Tap login button
    $loginButtonY = $screenHeight * 0.55
    Write-Host "Tapping login button at ($usernameX, $loginButtonY)" -ForegroundColor Gray
    Tap-Coordinate $usernameX $loginButtonY
    
    # Wait for navigation
    Wait-Seconds 3
    
    # Check if home screen appears
    $dump = Get-ScreenDump
    if ($dump -match "Reservasi" -or $dump -match "Home" -or $dump -match "Stok") {
        Log-Test "Login successful" "PASS" "Home screen detected"
    } else {
        Log-Test "Login successful" "FAIL" "Home screen not detected"
        
        # Check for error message
        if ($dump -match "error" -or $dump -match "invalid" -or $dump -match "gagal") {
            Log-Test "Login error handling" "PASS" "Error message shown"
        }
    }
} else {
    Log-Test "Get screen size" "FAIL" "Could not determine screen size"
}

# ========================================
# TEST 3: Home Screen Navigation
# ========================================
Write-Host "`n[TEST 3] Home Screen Navigation" -ForegroundColor Cyan
Wait-Seconds 2
$dump = Get-ScreenDump

# Check for main buttons
$buttons = @("Reservasi", "Stok", "Opname", "Laporan", "Karyawan")
foreach ($button in $buttons) {
    if ($dump -match $button) {
        Log-Test "Button '$button' visible" "PASS" "Found on home screen"
    } else {
        Log-Test "Button '$button' visible" "FAIL" "Not found on home screen"
    }
}

# ========================================
# TEST 4: Navigate to Appointments
# ========================================
Write-Host "`n[TEST 4] Navigate to Appointments" -ForegroundColor Cyan

# Try to find and tap Reservasi button
$reservasiY = $screenHeight * 0.3
Write-Host "Tapping Reservasi button" -ForegroundColor Gray
Tap-Coordinate ($screenWidth / 2) $reservasiY
Wait-Seconds 2

$dump = Get-ScreenDump
if ($dump -match "Appointment" -or $dump -match "Reservasi") {
    Log-Test "Navigate to Appointments" "PASS" "Appointment screen loaded"
    
    # Check for list items or empty state
    Wait-Seconds 1
    $dump = Get-ScreenDump
    if ($dump -match "PENDING" -or $dump -match "CONFIRMED" -or $dump -match "Empty" -or $dump -match "Tidak ada") {
        Log-Test "Appointment list loads" "PASS" "List or empty state shown"
    } else {
        Log-Test "Appointment list loads" "FAIL" "No list or empty state"
    }
} else {
    Log-Test "Navigate to Appointments" "FAIL" "Appointment screen not loaded"
}

# Go back to home
Press-Back
Wait-Seconds 1

# ========================================
# TEST 5: Navigate to Inventory
# ========================================
Write-Host "`n[TEST 5] Navigate to Inventory Movements" -ForegroundColor Cyan

$inventoryY = $screenHeight * 0.4
Write-Host "Tapping Inventory button" -ForegroundColor Gray
Tap-Coordinate ($screenWidth / 2) $inventoryY
Wait-Seconds 2

$dump = Get-ScreenDump
if ($dump -match "Inventory" -or $dump -match "Stok" -or $dump -match "Movement") {
    Log-Test "Navigate to Inventory" "PASS" "Inventory screen loaded"
} else {
    Log-Test "Navigate to Inventory" "FAIL" "Inventory screen not loaded"
}

Press-Back
Wait-Seconds 1

# ========================================
# TEST 6: Navigate to Stock Opname
# ========================================
Write-Host "`n[TEST 6] Navigate to Stock Opname" -ForegroundColor Cyan

$opnameY = $screenHeight * 0.5
Write-Host "Tapping Stock Opname button" -ForegroundColor Gray
Tap-Coordinate ($screenWidth / 2) $opnameY
Wait-Seconds 2

$dump = Get-ScreenDump
if ($dump -match "Opname" -or $dump -match "Physical") {
    Log-Test "Navigate to Stock Opname" "PASS" "Stock Opname screen loaded"
} else {
    Log-Test "Navigate to Stock Opname" "FAIL" "Stock Opname screen not loaded"
}

Press-Back
Wait-Seconds 1

# ========================================
# TEST 7: Navigate to Sales Report
# ========================================
Write-Host "`n[TEST 7] Navigate to Sales Report" -ForegroundColor Cyan

$reportY = $screenHeight * 0.6
Write-Host "Tapping Sales Report button" -ForegroundColor Gray
Tap-Coordinate ($screenWidth / 2) $reportY
Wait-Seconds 2

$dump = Get-ScreenDump
if ($dump -match "Report" -or $dump -match "Laporan" -or $dump -match "Sales") {
    Log-Test "Navigate to Sales Report" "PASS" "Sales Report screen loaded"
} else {
    Log-Test "Navigate to Sales Report" "FAIL" "Sales Report screen not loaded"
}

Press-Back
Wait-Seconds 1

# ========================================
# TEST 8: Navigate to Employee Management
# ========================================
Write-Host "`n[TEST 8] Navigate to Employee Management" -ForegroundColor Cyan

$employeeY = $screenHeight * 0.7
Write-Host "Tapping Employee button" -ForegroundColor Gray
Tap-Coordinate ($screenWidth / 2) $employeeY
Wait-Seconds 2

$dump = Get-ScreenDump
if ($dump -match "Employee" -or $dump -match "Karyawan") {
    Log-Test "Navigate to Employee" "PASS" "Employee screen loaded"
} else {
    Log-Test "Navigate to Employee" "FAIL" "Employee screen not loaded"
}

Press-Back
Wait-Seconds 1

# ========================================
# TEST 9: Check for Crashes
# ========================================
Write-Host "`n[TEST 9] Check for Crashes" -ForegroundColor Cyan

$crashes = adb -s $DEVICE logcat -d | Select-String "AndroidRuntime.*FATAL"
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

$process = adb -s $DEVICE shell "ps -A | grep $PACKAGE"
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
Write-Host "Total Tests: $($passed + $failed)" -ForegroundColor White
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor Red
Write-Host "Success Rate: $([math]::Round($passed / ($passed + $failed) * 100, 2))%" -ForegroundColor Yellow

# Save results to file
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$reportFile = "AUTOMATED_TEST_REPORT_$timestamp.txt"
$results | Format-Table -AutoSize | Out-File $reportFile
Write-Host "`nReport saved to: $reportFile" -ForegroundColor Cyan

# Export detailed results
$results | Export-Csv "AUTOMATED_TEST_RESULTS_$timestamp.csv" -NoTypeInformation
Write-Host "CSV saved to: AUTOMATED_TEST_RESULTS_$timestamp.csv" -ForegroundColor Cyan

Write-Host "`n========================================`n" -ForegroundColor Cyan
