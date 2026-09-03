<#
  lib.JobObject.ps1 - Primitive de supervision de la stack de dev Enclume.

  Un Job Object Windows NOMME ("Enclume_DevStack") est la source de verite unique
  de "la stack tourne-t-elle ?". C'est le pattern de PostgreSQL sur Windows
  (postmaster : CreateJobObject nomme + JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, les
  enfants heritent, handle jamais ferme explicitement, non-fatal si echec).

  Ce fichier se dot-source ; il n'execute rien de lui-meme. Il expose :
    - $DevStackJobName                : le nom du job
    - Enter-DevStackJob               : cree le job, l'arme, y assigne le process courant
    - Get-DevStackJobActiveProcesses  : nb de process vivants dans le job (0 si absent)
    - Stop-DevStackJob                : TerminateJobObject (tue tout l'arbre en un appel)

  References :
    - https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects
    - https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-createjobobjectw
    - PostgreSQL : "Use Windows Job Objects to prevent orphaned child processes"
#>

Set-Variable -Name DevStackJobName -Value 'Enclume_DevStack' -Scope Script -Force

if (-not ([System.Management.Automation.PSTypeName]'Enclume.JobObjectNative').Type) {
  Add-Type -Namespace 'Enclume' -Name 'JobObjectNative' -MemberDefinition @'
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateJobObject(IntPtr lpJobAttributes, string lpName);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr OpenJobObject(uint dwDesiredAccess, [MarshalAs(UnmanagedType.Bool)] bool bInheritHandle, string lpName);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool AssignProcessToJobObject(IntPtr hJob, IntPtr hProcess);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpInfo, uint cbInfo);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool QueryInformationJobObject(IntPtr hJob, int infoClass, IntPtr lpInfo, uint cbInfo, IntPtr lpReturnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool TerminateJobObject(IntPtr hJob, uint uExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr hObject);

    [StructLayout(LayoutKind.Sequential)]
    public struct IO_COUNTERS {
      public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
      public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
      public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
      public uint LimitFlags;
      public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
      public uint ActiveProcessLimit;
      public UIntPtr Affinity;
      public uint PriorityClass, SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
      public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
      public IO_COUNTERS IoInfo;
      public UIntPtr ProcessMemoryLimit, JobMemoryLimit;
      public UIntPtr PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION {
      public long TotalUserTime, TotalKernelTime;
      public long ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
      public uint TotalPageFaultCount;
      public uint TotalProcesses;
      public uint ActiveProcesses;
      public uint TotalTerminatedProcesses;
    }

    public const int  JobObjectBasicAccountingInformation = 1;
    public const int  JobObjectExtendedLimitInformation   = 9;
    public const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE   = 0x2000;
    public const uint JOB_OBJECT_QUERY                     = 0x0004;
    public const uint JOB_OBJECT_TERMINATE                 = 0x0008;
    public const int  ERROR_ALREADY_EXISTS                 = 183;
    public const int  ERROR_ACCESS_DENIED                  = 5;
'@
}

function Enter-DevStackJob {
  <#
    Cree (ou ouvre) le job nomme et y assigne le process courant.
    Retourne un objet : @{ AlreadyExists; Assigned; Warning }.
    - AlreadyExists = $true  -> une stack tourne deja, l'appelant doit renoncer.
    - Assigned      = $true  -> KILL_ON_JOB_CLOSE arme, les enfants heriteront.
    - Assigned      = $false -> P/Invoke a echoue ; l'appelant continue en mode degrade.
    Le handle du job n'est JAMAIS ferme : Windows le ferme a la mort du process,
    ce qui declenche KILL_ON_JOB_CLOSE.
  #>
  [CmdletBinding()]
  param()

  $N = [Enclume.JobObjectNative]
  $result = [ordered]@{ AlreadyExists = $false; Assigned = $false; Warning = $null }

  try {
    $job = $N::CreateJobObject([IntPtr]::Zero, $script:DevStackJobName)
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()

    if ($job -eq [IntPtr]::Zero) {
      throw "CreateJobObject a echoue (code $err)"
    }
    if ($err -eq $N::ERROR_ALREADY_EXISTS) {
      $result.AlreadyExists = $true
      # On garde ce handle ouvert sans rien en faire : inoffensif, referme a la sortie.
      return [pscustomobject]$result
    }

    # Armer KILL_ON_JOB_CLOSE.
    $info = New-Object Enclume.JobObjectNative+JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    $info.BasicLimitInformation.LimitFlags = $N::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    $size = [System.Runtime.InteropServices.Marshal]::SizeOf([type][Enclume.JobObjectNative+JOBOBJECT_EXTENDED_LIMIT_INFORMATION])
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($size)
    try {
      [System.Runtime.InteropServices.Marshal]::StructureToPtr($info, $ptr, $false)
      if (-not $N::SetInformationJobObject($job, $N::JobObjectExtendedLimitInformation, $ptr, $size)) {
        throw "SetInformationJobObject a echoue (code $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
      }
    } finally {
      [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    }

    # Assigner le process courant. Les descendants (npm, concurrently, nodemon,
    # node, vite...) heritent automatiquement de l'appartenance au job.
    $self = [System.Diagnostics.Process]::GetCurrentProcess().Handle
    if (-not $N::AssignProcessToJobObject($job, $self)) {
      $aerr = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
      if ($aerr -eq $N::ERROR_ACCESS_DENIED) {
        throw "process deja dans un job non-nestable (code $aerr)"
      }
      throw "AssignProcessToJobObject a echoue (code $aerr)"
    }

    $result.Assigned = $true
    $global:__EnclumeDevStackJobHandle = $job   # ancrage explicite du handle
    return [pscustomobject]$result
  }
  catch {
    $result.Warning = $_.Exception.Message
    return [pscustomobject]$result
  }
}

function Get-DevStackJobActiveProcesses {
  <# Nombre de process vivants dans le job nomme. 0 si le job n'existe pas. #>
  [CmdletBinding()]
  [OutputType([int])]
  param()

  $N = [Enclume.JobObjectNative]
  $h = $N::OpenJobObject($N::JOB_OBJECT_QUERY, $false, $script:DevStackJobName)
  if ($h -eq [IntPtr]::Zero) { return 0 }

  try {
    $size = [System.Runtime.InteropServices.Marshal]::SizeOf([type][Enclume.JobObjectNative+JOBOBJECT_BASIC_ACCOUNTING_INFORMATION])
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($size)
    try {
      if (-not $N::QueryInformationJobObject($h, $N::JobObjectBasicAccountingInformation, $ptr, $size, [IntPtr]::Zero)) {
        return 0
      }
      $acct = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][Enclume.JobObjectNative+JOBOBJECT_BASIC_ACCOUNTING_INFORMATION])
      return [int]$acct.ActiveProcesses
    } finally {
      [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    }
  } finally {
    [void]$N::CloseHandle($h)
  }
}

function Stop-DevStackJob {
  <# Tue tout l'arbre de la stack en un appel noyau. Retourne $true si un job a ete trouve. #>
  [CmdletBinding()]
  [OutputType([bool])]
  param()

  $N = [Enclume.JobObjectNative]
  $access = $N::JOB_OBJECT_TERMINATE -bor $N::JOB_OBJECT_QUERY
  $h = $N::OpenJobObject($access, $false, $script:DevStackJobName)
  if ($h -eq [IntPtr]::Zero) { return $false }

  try {
    [void]$N::TerminateJobObject($h, 0)
    return $true
  } finally {
    [void]$N::CloseHandle($h)
  }
}
