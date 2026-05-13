param(
    [Parameter(Mandatory = $true)]
    [string]$PrinterName,

    [Parameter(Mandatory = $true)]
    [string]$FilePath
)

$resolvedPath = Resolve-Path -Path $FilePath -ErrorAction Stop
$content = Get-Content -Path $resolvedPath -Raw -Encoding UTF8

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes)
    {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;

        var di = new DOCINFOA();
        di.pDocName = "Cupom ESCPOS";
        di.pDataType = "RAW";

        bool success = false;
        IntPtr pUnmanagedBytes = IntPtr.Zero;

        try
        {
            if (!StartDocPrinter(hPrinter, 1, di)) return false;
            if (!StartPagePrinter(hPrinter)) return false;

            pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

            int written;
            success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
        }
        finally
        {
            if (pUnmanagedBytes != IntPtr.Zero) Marshal.FreeCoTaskMem(pUnmanagedBytes);
            ClosePrinter(hPrinter);
        }

        return success;
    }
}
"@

$encoder = [System.Text.Encoding]::GetEncoding(850)
$bytesText = $encoder.GetBytes($content + "`r`n")

# ESC @ (init)
$init = [byte[]](27, 64)
# ESC d n (alimenta n linhas)
$feed = [byte[]](27, 100, 4)
# GS V B 0 (full cut)
$cut = [byte[]](29, 86, 66, 0)

$payload = New-Object byte[] ($init.Length + $bytesText.Length + $feed.Length + $cut.Length)
[Array]::Copy($init, 0, $payload, 0, $init.Length)
[Array]::Copy($bytesText, 0, $payload, $init.Length, $bytesText.Length)
[Array]::Copy($feed, 0, $payload, $init.Length + $bytesText.Length, $feed.Length)
[Array]::Copy($cut, 0, $payload, $init.Length + $bytesText.Length + $feed.Length, $cut.Length)

$result = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $payload)
if (-not $result) {
    Write-Error "Falha ao enviar dados RAW para a impressora '$PrinterName'."
    exit 1
}

Write-Output "Impressao RAW enviada com sucesso para '$PrinterName'."
exit 0
