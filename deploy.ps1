Write-Host "cleaning artifacts of previous builds . . ." -ForegroundColor Cyan

if (Test-Path -Path "mta_archives") {
    Remove-Item -Recurse -Force mta_archives
    Write-Host "Removed mta_archives" -ForegroundColor Green
}

Write-Host "ui5 app build and compiling js to ts" -ForegroundColor Cyan

cd test
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Warning "npm run build failed"
    cd ..
    exit 1
}
Write-Host "UI5 build completed" -ForegroundColor Green
cd ..

Write-Host "copying build files to app/router/resources folder for deploy" -ForegroundColor Cyan

$resourcesDir = "app/router/resources"
if (Test-Path -Path $resourcesDir) {
    Remove-Item -Recurse -Force $resourcesDir
}
New-Item -ItemType Directory -Path $resourcesDir -Force | Out-Null


Copy-Item -Path "test/dist/*" -Destination "$resourcesDir/" -Recurse -Force


New-Item -ItemType Directory -Path "$resourcesDir/test" -Force
Get-ChildItem -Path $resourcesDir -Exclude test | Move-Item -Destination "$resourcesDir/test/" -Force


Copy-Item -Path "$resourcesDir/test/index.html" -Destination "$resourcesDir/index.html" -Force

Write-Host "Copied files to $resourcesDir" -ForegroundColor Green

Write-Host "building mta archive (mbt build)" -ForegroundColor Cyan
mbt build

if ($LASTEXITCODE -ne 0) {
    Write-Warning "mbt build command failed"
    exit 1
}
Write-Host "MTA build completed" -ForegroundColor Green

Write-Host "deploying mta archive to sap btp" -ForegroundColor Cyan

$mtarFile = Get-ChildItem -Path mta_archives -Filter "*.mtar" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($mtarFile) {
    Write-Host "Deploying $($mtarFile.Name)..." -ForegroundColor Yellow
    cf deploy $mtarFile.FullName
} else {
    Write-Warning "No .mtar file found"
    exit 1
}
Write-Host "your app is deployed" -ForegroundColor Cyan