<#
=============================================================================
KỊCH BẢN ĐẨY MÃ NGUỒN LÊN HUGGING FACE SPACES (SDK: GRADIO - FREE 100%)
Không cần thẻ tín dụng - Tự động triển khai AI Qwen2.5-3B OpenAI API
=============================================================================
#>

param (
    [Parameter(Mandatory=$false)]
    [string]$SpaceRepoUrl = ""
)

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "🚀 TRIỂN KHAI MÁY CHỦ AI LÊN HUGGING FACE SPACES (SDK: GRADIO)" -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Cyan

if (-not $SpaceRepoUrl) {
    Write-Host "`n[HƯỚNG DẪN 1 PHÚT TẠO SPACE TRÊN HUGGING FACE]:" -ForegroundColor Green
    Write-Host "1. Đăng nhập https://huggingface.co (Bằng Email hoặc GitHub, không cần thẻ)" -ForegroundColor White
    Write-Host "2. Nhấn biểu tượng avatar góc phải -> Chọn 'New Space'" -ForegroundColor White
    Write-Host "3. Điền:" -ForegroundColor White
    Write-Host "   - Space name : qwen-ubnd-catngan" -ForegroundColor Yellow
    Write-Host "   - Space SDK  : Chọn 'Gradio'" -ForegroundColor Yellow
    Write-Host "   - Hardware   : CPU basic (2 vCPU, 16GB RAM) - Free" -ForegroundColor Yellow
    Write-Host "   - Visibility : Public (hoặc Private)" -ForegroundColor Yellow
    Write-Host "4. Nhấn 'Create Space'" -ForegroundColor White
    Write-Host "5. Copy đường link Clone repository (ví dụ: https://huggingface.co/spaces/YOUR_USERNAME/qwen-ubnd-catngan)`n" -ForegroundColor White

    $SpaceRepoUrl = Read-Host "Dán đường dẫn Space Git URL của bạn vào đây"
}

if (-not $SpaceRepoUrl) {
    Write-Host "❌ Bạn chưa nhập URL Space. Hủy thao tác." -ForegroundColor Red
    Exit
}

$tempDir = Join-Path $PSScriptRoot "temp_hf_space"
$srcDir = Join-Path $PSScriptRoot "huggingface_space"

# Dọn dẹp thư mục tạm cũ
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n[1/4] Đang clone repository từ Hugging Face..." -ForegroundColor Cyan
git clone $SpaceRepoUrl $tempDir

if (-not (Test-Path $tempDir)) {
    Write-Host "❌ Không clone được repo. Vui lòng kiểm tra quyền truy cập hoặc Access Token của Hugging Face." -ForegroundColor Red
    Exit
}

Write-Host "`n[2/4] Đang sao chép các tệp Gradio Space..." -ForegroundColor Cyan
Copy-Item (Join-Path $srcDir "app.py") $tempDir -Force
Copy-Item (Join-Path $srcDir "requirements.txt") $tempDir -Force
Copy-Item (Join-Path $srcDir "README.md") $tempDir -Force

Set-Location $tempDir

Write-Host "`n[3/4] Đang đóng gói và đẩy (Push) lên Hugging Face..." -ForegroundColor Cyan
git add .
git commit -m "Deploy Qwen2.5-3B Gradio + OpenAI-compatible API for UBND Xa Cat Ngan"
git push

Set-Location $PSScriptRoot
Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host "🎉 ĐÃ ĐẨY LÊN HUGGING FACE THÀNH CÔNG!" -ForegroundColor Green
Write-Host "Hugging Face đang tự động khởi chạy Gradio Space (khoảng 1-2 phút)." -ForegroundColor White
Write-Host ""
Write-Host "Đường dẫn API của bạn sẽ là:" -ForegroundColor Yellow
$cleanUrl = $SpaceRepoUrl.Replace(".git", "").Replace("https://huggingface.co/spaces/", "")
$parts = $cleanUrl.Split("/")
if ($parts.Length -ge 2) {
    $user = $parts[0]
    $space = $parts[1]
    Write-Host "https://$user-$space.hf.space" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Để kết nối vào Backend .NET, cập nhật appsettings.json:" -ForegroundColor White
    Write-Host "`"AiProvider`": {" -ForegroundColor White
    Write-Host "  `"Type`": `"ApiCompatible`"," -ForegroundColor White
    Write-Host "  `"Api`": {" -ForegroundColor White
    Write-Host "    `"BaseUrl`": `"https://$user-$space.hf.space`"," -ForegroundColor Yellow
    Write-Host "    `"Model`": `"qwen2.5-3b-instruct-q4_k_m`"," -ForegroundColor Yellow
    Write-Host "    `"DataSovereigntyAcknowledged`": true" -ForegroundColor White
    Write-Host "  }" -ForegroundColor White
    Write-Host "}" -ForegroundColor White
}
Write-Host "=====================================================================" -ForegroundColor Cyan
