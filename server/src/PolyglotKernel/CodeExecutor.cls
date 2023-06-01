/// Derived from https://github.com/grongierisc/iris-python-template/blob/cdaacdf47c544b4f814a9ed4e2e1846ec0c0d441/src/ObjectScript/Kernel/CodeExecutor.cls
Class PolyglotKernel.CodeExecutor
{

/// SQL function returning superserver port number,
/// enabling client using /api/atelier to leverage other connectivity, e.g. Node.js Native API
/// provided firewalling and routing allows.
/// Use /api/atelier/v1/:namespace/action/query to SELECT PolyglotKernel.CodeExecutor_SuperServerPort()
ClassMethod SuperServerPort() As %Integer [ SqlProc ]
{
	return $S($G(^%SYS("SSPort"))'="":^%SYS("SSPort"),1:1972)
}

/// SQL function returning uppercased FQDN of host,
/// enabling client using /api/atelier to leverage other connectivity, e.g. Node.js Native API
/// provided firewalling and routing allows.
/// Use /api/atelier/v1/:namespace/action/query to SELECT PolyglotKernel.CodeExecutor_HostName()
ClassMethod HostName() As %String [ SqlProc ]
{
	return ##class(%SYS.System).GetNodeName()
}

ClassMethod Init(clientJSON As %String) As %String
{
	// Kill the %-variables which the Native API for Node.js initially creates in its server-side process, as they seem to be redundant.
	kill

	// Report versions
	return {"apiVersion":("1.0"), "serverVersion":($zversion)}.%ToJSON()
}

ClassMethod CodeResult(zzPKCE1 As %String, zzPKCE2 As %String = "python") As %String [ ProcedureBlock = 0 ]
{
	// This method deliberately doesn't use procedure-block variable scoping.
	//
	// Minimize the number of local variables (zzPKCE*) that we trample on in the user's symbol table:
	// These are NEWed by being formal parameters
#Define vstrCommand zzPKCE1
#Define type zzPKCE2
	// Later they will need to be NEWed in the XECUTE string.
#Define newCommand ##Quote(new $$$vstrCommand,$$$type)

	// These are explicitly NEWed here
#Define codeArray zzPKCE3
#Define err zzPKCE4
	new $$$codeArray,$$$err

	// Subnodes of one of the formal parameter variables are used for other purposes
#Define tOldIORedirected $$$type(1)
#Define tOldMnemonic $$$type(2)
#Define tOldIO $$$type(3)
#Define status $$$type(4)
#Define stdiomode $$$type(5)
#Define ex $$$type(6)
#Define tStatement $$$type(7)
#Define qStatus $$$type(8)
#Define rset $$$type(9)
#Define sc $$$type(10)
#Define tempDatabase $$$type(10)

	// This Process-Private Global will accumulate the output, and to preserve context such as $test and $zreference
#Define str ^||zzPKCE

	// Record what will need to be reinstated
	set $$$tOldIORedirected = ##class(%Device).ReDirectIO()
	set $$$tOldMnemonic = ##class(%Device).GetMnemonicRoutine()
	set $$$tOldIO = $io
	try {
		if ('$SYSTEM.Security.Check("%Development","U")) {
			throw ##class(%Exception.StatusException).CreateFromStatus($SYSTEM.Status.Error(921, "%Development:Use"))
		}

		// Init the PPG
		d output("", "")
		set $$$status = 1

		//Redirect IO to the current routine - makes use of the labels defined below
		use $io::("^"_$ZNAME)
		do ##class(%Device).ReDirectIO(1)

		if $$$type = "cos" {
			try {
				// Prepare code for checking and conversion into a runnable routine
				set $$$codeArray = $name($$$codeArray)
				for $$$codeArray(0) = 1:1:$length($$$vstrCommand, $c(10)) {
					set $$$codeArray($$$codeArray(0)) = $piece($$$vstrCommand, $c(10), $$$codeArray(0))

					// Avoid omitting a completely empty line
					if $$$codeArray($$$codeArray(0)) = "" set $$$codeArray($$$codeArray(0)) = " "
				}

				//Pre-flight check of code. If it fails, guess that linestart spaces are missing.
				if $compile(@$$$codeArray, 0, $$$err) for $$$codeArray(0) = 1:1:$$$codeArray(0) set $$$codeArray($$$codeArray(0)) = " "_$$$codeArray($$$codeArray(0))

				// Create a process-specific temp routine in the temp database
				set $$$tempDatabase = "^"_##class(%SYS.Namespace).GetGlobalDest(,"^CacheTemp")
				xecute "new $namespace set $namespace = """_$$$tempDatabase_""" zremove  xecute ""f "_$$$codeArray_"(0) = 1:1:"_$$$codeArray_"(0) zinsert "_$$$codeArray_"("_$$$codeArray_"(0))"" zsave @(""zzPKCEjob""_$j)"

				// We no longer need these and shouldn't leak them to user code
				kill $$$codeArray, $$$err

				// Reinstate any context previously stored in our PPG, run the routine, then save context
				if $get($$$str("$test"))
				set $zr = $get($$$str("$zreference"))
				xecute $$$newCommand_" do @(""^|"""""_$$$tempDatabase_"""""|zzPKCEjob"_$j_""")"
				set $$$str("$zreference") = $zr
				set $$$str("$test") = $test
			}
			catch $$$ex {
				do output($$$ex.DisplayString(), "")
				set $$$status = 0
			}
		}
		elseif $$$type = "sql" {
			set $$$tStatement =  ##class(%SQL.Statement).%New()
			set $$$qStatus = $$$tStatement.%Prepare($$$vstrCommand)
			if $$$qStatus '= 1 {
				write "%SQL.Statement::%Prepare failed:"
				do $System.Status.DisplayError($$$qStatus)
				set $$$status = 0
			}
			else {
				set $$$rset = $$$tStatement.%Execute()
				if $$$rset.%SQLCODE >= 0 {
					do $$$rset.%Display()
				}
				else {
					write "%SQL.Statement::%Execute failed with %SQLCODE=",$$$rset.%SQLCODE," and %Message=",$$$rset.%Message,!
					set $$$status = 0
				}
			}
		}
		elseif $$$type = "python" {

			// Briefly switch to the implied namespace of the current namespace's global database
			// as a workaround for the bug in which Embedded Python output sometimes gets mangled.
			xecute "new $namespace set $namespace = ""^"_##class(%SYS.Namespace).GetGlobalDest()_""""

			set $$$stdiomode = ##class(%SYS.Python).SetStdIOMode(3)
			set $$$sc = ##class(%SYS.Python).Run($$$vstrCommand)
			if $$$sc = -1 {
				d output("%SYS.Python::Run failed", "")
				set $$$status = 0
			}
		}
		else {
			d output("Language '"_$$$type_"' is not spoken here.", "")
			set $$$status = 0
		}

	} catch $$$ex {
		do output($$$ex.DisplayString(), "")
		set $$$status = 0
	}

	//Return to original redirection/mnemonic routine settings
	if ($$$tOldMnemonic '= "") {
		use $$$tOldIO::("^"_$$$tOldMnemonic)
	} else {
		use $$$tOldIO
	}
	do ##class(%Device).ReDirectIO($$$tOldIORedirected)
	do:$get($$$stdiomode)'="" ##class(%SYS.Python).SetStdIOMode($$$stdiomode)

	// Return the result as JSON
	return {"status":($$$status), "out":($$$str)}.%ToJSON()

#; Subroutine used by IO redirection code to accumulate output into our PPG
output(s, prefix)
	new zr
	set zr = $zr
    set $$$str = $g(prefix, $g($$$str))_s
	set $zr = zr
    quit

#; IO redirection labels
rchr(timeout)
	; TODO if the stdin channel can be made to work and we have a value to quit with.
	; Until then, report <ZREAD> on a READ * command.
	ztrap "READ"
    quit
rstr(size,timeout)
	; TODO if the stdin channel can be made to work and we have a value to quit with.
	; Until then, report <ZREAD> on a READ command.
	ztrap "READ"
    quit
wchr(s)
    do output($char(s))
    quit
wff()
    do output($char(12))
    quit
wnl()
    do output($char(13,10))
    quit
wstr(s)
    do output(s)
    quit
wtab(s)
    do output($char(9))
    quit
}

}
