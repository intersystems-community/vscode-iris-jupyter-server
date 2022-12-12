/// Derived from https://github.com/grongierisc/iris-python-template/blob/cdaacdf47c544b4f814a9ed4e2e1846ec0c0d441/src/ObjectScript/Kernel/CodeExecutor.cls
Class PolyglotKernel.CodeExecutor
{

ClassMethod CodeResult(zzPKCE1 As %String, zzPKCE2 As %String = "python") As %String [ ProcedureBlock = 0 ]
{
#Define vstrCommand zzPKCE1
#Define type zzPKCE2
#Define codeArray zzPKCE3
#Define qCodeArray ##Quote(zzPKCE3)
#Define err zzPKCE4
#Define NewList ##Quote(New $$$vstrCommand,$$$type)

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
		d output("", "")
		set $$$status = 1
		//Redirect IO to the current routine - makes use of the labels defined below
		use $io::("^"_$ZNAME)

		//Enable redirection
		do ##class(%Device).ReDirectIO(1)
		Set $$$stdiomode = ##class(%SYS.Python).SetStdIOMode(3)

		if $$$type = "cos" {
			Try {
				set $$$codeArray = $$$qCodeArray
				for $$$codeArray(0) = 1:1:$length($$$vstrCommand, $c(10)) set $$$codeArray($$$codeArray(0)) = $piece($$$vstrCommand, $c(10), $$$codeArray(0))
				if $compile(@$$$codeArray, 0, $$$err) for $$$codeArray(0) = 1:1:$$$codeArray(0) set $$$codeArray($$$codeArray(0)) = " "_$$$codeArray($$$codeArray(0))
				set $$$tempDatabase = "^"_##class(%SYS.Namespace).GetGlobalDest(,"^CacheTemp")
				XECUTE "new $namespace set $namespace = """_$$$tempDatabase_""" zr  xecute ""f "_$$$codeArray_"(0) = 1:1:"_$$$codeArray_"(0) zi "_$$$codeArray_"("_$$$codeArray_"(0))"" zs @(""temp""_$j)"
				XECUTE $$$NewList_" d @(""^|"""""_$$$tempDatabase_"""""|temp"_$j_""")"
			}
			Catch $$$ex {
				d output($$$ex.DisplayString(), "")
				set $$$status = 0
			}
		}
		elseif $$$type = "sql" {
			set $$$tStatement =  ##class(%SQL.Statement).%New()
			SET $$$qStatus = $$$tStatement.%Prepare($$$vstrCommand)
			IF $$$qStatus'=1 {WRITE "%Prepare failed:" DO $System.Status.DisplayError($$$qStatus) SET $$$status = 0 QUIT}
			SET $$$rset = $$$tStatement.%Execute()
			DO $$$rset.%Display()
		}
		elseif $$$type = "python" {
			set $$$sc = ##class(%SYS.Python).Run($$$vstrCommand)
			if $$$sc = -1 {
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
	Do:$$$stdiomode'="" ##class(%SYS.Python).SetStdIOMode($$$stdiomode)

	new jsonOut,zr
	set zr = $zr
	set jsonOut = {"status":($$$status), "out":($$$str)}.%ToJSON()
	set $zr = zr
	return jsonOut

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
output(s, prefix)
	new zr
	set zr = $zr
    set $$$str = $g(prefix, $g($$$str)) _ s
	set $zr = zr
    quit
}

}
