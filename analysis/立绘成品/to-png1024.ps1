Add-Type -AssemblyName System.Drawing
$src = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent $src)
$dst = Join-Path $root 'plugin\data\images'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$ids = @('liqinghong','lijiangqian','litongya','lizhouwei','lixuanxuan','liyuanjiao','lixizhi','lixijun','lujiangxian','liquewan','lixuanfeng','chibuzi','liuchangdie','lisuining','lixiangping','xiaochuting','tinglan','liyuanping','kongheng','yangruiyi','ningwan','lichijing','chendonghe','cuijueyin','liyuanxiu','limutian','xiaoguiluan','anzheyu','xiaoyan','yaochen','cailin','ziyan','yunyun','huntiandi','xiaoyixian','xuqian','weiyuan','limiaozhen','yuanjingdi','jianzheng','shenshu','wushen','ruibeikasaixier','ameng','luosaiergusitafu','aimulinhuaite','aosaikusi','xiudiercha','ziling','nangongwan','yuanyao','yinyue','tihun','yanli','wangchan','andesenhude','paliesisuoluoyaside','bansenmoleidi','xuanyewang','foersiwoer','aerjieweierxun','dailikeboge','azikeaigesi','lieaodeluo','meigaoousi','zhenshizaowuzhu','meilishamoleidi','amannixisi','lunnademiqieer','gaowensaixier','hanli','hedisaixier','hupo','yinsizangeweier')
foreach ($id in $ids) {
  $file = Get-ChildItem -Path $src -Filter ($id + '-*.jpg') | Select-Object -First 1
  if ($null -eq $file) { Write-Output "SKIP $id"; continue }
  $out = Join-Path $dst ($id + '.png')
  $img = [System.Drawing.Image]::FromFile($file.FullName)
  $scale = 1024 / [Math]::Max($img.Width, $img.Height)
  $w = [int][Math]::Round($img.Width * $scale)
  $h = [int][Math]::Round($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $g.Dispose()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $img.Dispose()
  $kb = [int]((Get-Item $out).Length / 1KB)
  Write-Output ("OK {0} <- {1}  {2}x{3}  {4}KB" -f $id, $file.Name, $w, $h, $kb)
}
Remove-Item (Join-Path $src 'liqinghong-FE013.jpg') -ErrorAction SilentlyContinue
