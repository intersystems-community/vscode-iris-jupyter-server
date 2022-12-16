/// Derived from https://github.com/grongierisc/iris-python-template/blob/cdaacdf47c544b4f814a9ed4e2e1846ec0c0d441/src/ObjectScript/Kernel/CodeExecutor.cls
Class PolyglotKernel.CodeExecutor
{

ClassMethod Init(clientJSON As %String) As %String
{
	// Remove the %-variables which the Native API for Node.js initially creates in its server-side process
	kill

	// Report versions
	return {"apiVersion":("1.0"), "serverVersion":($zversion)}.%ToJSON()
}

ClassMethod CodeResult(zzPKCE1 As %String, zzPKCE2 As %String = "python") As %String [ ProcedureBlock = 0 ]
{
#Define vstrCommand zzPKCE1
#Define type zzPKCE2
#Define codeArray zzPKCE3
#Define err zzPKCE4
#Define newCommand ##Quote(new $$$vstrCommand,$$$type)

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

#Define str ^||zzPKCE

	set $$$tOldIORedirected = ##class(%Device).ReDirectIO()
	set $$$tOldMnemonic = ##class(%Device).GetMnemonicRoutine()
	set $$$tOldIO = $io
	try {
		if ('$SYSTEM.Security.Check("%Development","U")) {
			throw ##class(%Exception.StatusException).CreateFromStatus($SYSTEM.Status.Error(921, "%Development:Use"))
		}
		d output("", "")
		set $$$status = 1
		//Redirect IO to the current routine - makes use of the labels defined below
		use $io::("^"_$ZNAME)

		//Enable redirection
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

				// Reinstate any context previously stored in our PPG, then run the routine, then save context
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

	new jsonOut,zr
	set zr = $zr
	set jsonOut = {"status":($$$status), "out":($$$str)}.%ToJSON()
	set $zr = zr
	return jsonOut

#; Subroutine used by IO redirection code to accumulate output into our PPG
output(s, prefix)
	new zr
	set zr = $zr
    set $$$str = $g(prefix, $g($$$str))_s
	set $zr = zr
    quit

#; IO redirection labels
rchr(c)
    quit
rstr(sz,to)
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
