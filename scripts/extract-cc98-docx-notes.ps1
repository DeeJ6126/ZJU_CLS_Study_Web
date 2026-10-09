param(
  [Parameter(Mandatory)][string]$File,
  [Parameter(Mandatory)][string]$Output
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function Read-XmlEntry($Zip, $Name) {
  $reader = [IO.StreamReader]::new($Zip.GetEntry($Name).Open())
  try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Test-RunFlag($Run, $Flag) {
  $node = $Run.SelectSingleNode("./w:rPr/w:$Flag", $script:ns)
  if (!$node) { return $false }
  return $node.GetAttribute('val', $wordNamespace) -notin @('0', 'false', 'off')
}

function Format-Segments($Segments) {
  $output = [Text.StringBuilder]::new()
  $text = ''; $key = ''
  foreach ($segment in @($Segments) + @([pscustomobject]@{ Text=''; Key='END' })) {
    if ($segment.Key -ne $key -and $text) {
      $leading = [regex]::Match($text, '^\s*').Value
      $trailing = [regex]::Match($text, '\s*$').Value
      $value = $text.Trim()
      if ($value) {
        if ($key.Contains('S')) { $value = "~~$value~~" }
        if ($key.Contains('I')) { $value = "*$value*" }
        if ($key.Contains('B')) { $value = "**$value**" }
        [void]$output.Append($leading + $value + $trailing)
      } else { [void]$output.Append($text) }
      $text = ''
    }
    $key = $segment.Key
    $text += $segment.Text
  }
  return $output.ToString()
}

function Convert-Paragraph($Paragraph) {
  $segments = [Collections.Generic.List[object]]::new()
  $field = $null
  foreach ($run in $Paragraph.SelectNodes('.//w:r', $script:ns)) {
    $marker = $run.SelectSingleNode('./w:fldChar', $script:ns)
    if ($marker) {
      switch ($marker.GetAttribute('fldCharType', $wordNamespace)) {
        'begin' { $field = @{ Instruction=''; Result=$false; Segments=[Collections.Generic.List[object]]::new() } }
        'separate' { if ($field) { $field.Result = $true } }
        'end' {
          if ($field) {
            $label = Format-Segments $field.Segments
            if ($field.Instruction -match 'HYPERLINK\s+"?(https?://[^\s"]+)') {
              $label = '[' + $label + '](' + $Matches[1] + ')'
            }
            $segments.Add([pscustomobject]@{ Text=$label; Key='' })
            $field = $null
          }
        }
      }
      continue
    }
    if ($field -and !$field.Result) {
      $field.Instruction += -join ($run.SelectNodes('./w:instrText', $script:ns) | ForEach-Object { $_.InnerText })
      continue
    }
    $text = -join ($run.SelectNodes('./w:t|./w:br|./w:tab', $script:ns) | ForEach-Object {
      if ($_.LocalName -eq 'br') { "`n" } elseif ($_.LocalName -eq 'tab') { "`t" } else { $_.InnerText }
    })
    $key = ''
    if (Test-RunFlag $run 'b') { $key += 'B' }
    if (Test-RunFlag $run 'i') { $key += 'I' }
    if (Test-RunFlag $run 'strike') { $key += 'S' }
    $segment = [pscustomobject]@{ Text=$text; Key=$key }
    if ($field) { $field.Segments.Add($segment) } else { $segments.Add($segment) }
  }
  return Format-Segments $segments
}

$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $File))
try {
  $document = Read-XmlEntry $zip 'word/document.xml'
  $styles = Read-XmlEntry $zip 'word/styles.xml'
  $script:ns = [Xml.XmlNamespaceManager]::new($document.NameTable)
  $script:ns.AddNamespace('w', $wordNamespace)
  $styleNs = [Xml.XmlNamespaceManager]::new($styles.NameTable)
  $styleNs.AddNamespace('w', $wordNamespace)
  $levels = @{}
  foreach ($style in $styles.SelectNodes('//w:style[w:pPr/w:outlineLvl]', $styleNs)) {
    $levels[$style.GetAttribute('styleId', $wordNamespace)] = 1 + [int]$style.SelectSingleNode('./w:pPr/w:outlineLvl', $styleNs).GetAttribute('val', $wordNamespace)
  }
  $rows = [Collections.Generic.List[object]]::new()
  foreach ($p in $document.SelectNodes('//w:body//w:p', $script:ns)) {
    $style = $p.SelectSingleNode('./w:pPr/w:pStyle', $script:ns)
    $styleId = if ($style) { $style.GetAttribute('val', $wordNamespace) } else { '' }
    $plain = -join ($p.SelectNodes('.//w:t', $script:ns) | ForEach-Object { $_.InnerText })
    $rows.Add([pscustomobject]@{ Index=$rows.Count; Level=$levels[$styleId]; Text=$plain; Markdown=(Convert-Paragraph $p) })
  }
  $courses = @($rows | Where-Object { $_.Level -eq 1 -and $_.Text -match '^\d+L\s+' -and $_.Text -notmatch '前言|目录' })
  $notes = [Collections.Generic.List[object]]::new()
  $empty = [Collections.Generic.List[string]]::new()
  for ($c = 0; $c -lt $courses.Count; $c++) {
    $course = $courses[$c]
    if ($course.Text -notmatch '^(\d+)L\s+([A-Z]{2,}\d{4}[A-Z]*)') { continue }
    $floor = [int]$Matches[1]; $code = $Matches[2]
    $end = if ($c + 1 -lt $courses.Count) { $courses[$c + 1].Index } else { $rows.Count }
    $headers = @($rows | Where-Object { $_.Index -gt $course.Index -and $_.Index -lt $end -and $_.Level -in @(1, 2) -and $_.Text -match '^课程介绍(?:\s|[（(]|$)' })
    for ($h = 0; $h -lt $headers.Count; $h++) {
      $header = $headers[$h]
      $stop = if ($h + 1 -lt $headers.Count) { $headers[$h + 1].Index } else { $end }
      $materials = $rows | Where-Object { $_.Index -gt $header.Index -and $_.Index -lt $stop -and $_.Text.Trim() -match '^学习资料(?:[（(]|$)' } | Select-Object -First 1
      if ($materials) { $stop = $materials.Index }
      $bodyRows = @($rows | Where-Object { $_.Index -gt $header.Index -and $_.Index -lt $stop -and $_.Text.Trim() -and $_.Text -notmatch '^>+$' })
      if (!$bodyRows.Count) { $empty.Add($code); continue }
      $body = ($bodyRows | ForEach-Object {
        if ($_.Level) { ('#' * $_.Level) + ' ' + $_.Text } else { $_.Markdown }
      }) -join "`n`n"
      $plainBody = $bodyRows.Text -join "`n"
      $author = ''
      if ($header.Text -match '\bby\s*(.+)$') { $author = $Matches[1].Trim() }
      elseif ($course.Text -match '\bby\s*(.+)$') { $author = $Matches[1].Trim() }
      if ($author -match '^(\d{2,4}级)\s*(.+)$') { $author = $Matches[1] + ' ' + $Matches[2] }
      $teacher = ''
      if ($header.Text -match '[（(]([^）)]+)老师[）)]') { $teacher = $Matches[1] }
      $page = [Math]::Floor(($floor - 1) / 10) + 1
      $position = (($floor - 1) % 10) + 1
      $notes.Add([ordered]@{
        courseCode=$code; courseHeading=$course.Text; sourceFloor="${floor}L";
        title='资源楼'; summary="CC98 资源楼 ${floor}L"; author=$author; teacher=$teacher;
        body=$body; bodyFormat='markdown'; cc98Url="https://www.cc98.org/topic/6003753/${page}#${position}";
        sourceHeader=$header.Text; startParagraph=$header.Index; endParagraph=$stop;
        plainBody=$plainBody; plainBodyChars=$plainBody.Length
      })
    }
  }
  $manifest = [ordered]@{
    sourceDocument=[IO.Path]::GetFileName($File); sourceSha256=(Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant();
    count=$notes.Count; emptyCourseCodes=@($empty); notes=@($notes)
  }
  [IO.File]::WriteAllText([IO.Path]::GetFullPath($Output), ($manifest | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
  [pscustomobject]@{ Count=$notes.Count; Empty=$empty.Count; Output=$Output } | ConvertTo-Json -Compress
} finally { $zip.Dispose() }
