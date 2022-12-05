/// Derived from https://github.com/grongierisc/iris-python-template/blob/cdaacdf47c544b4f814a9ed4e2e1846ec0c0d441/src/ObjectScript/Kernel/CodeExecutor.cls
Class PolyglotKernel.CodeExecutor
{

ClassMethod CodeResult(zzPKCE1 As %String, zzPKCE2 As %String = "python") As %String [ ProcedureBlock = 0 ]
{
#Define vstrCommand zzPKCE1
#Define type zzPKCE2
#Define NewList ##Quote(New $$$vstrCommand,$$$type)

#Define tOldIORedirected $$$vstrCommand(1)
#Define tOldMnemonic $$$vstrCommand(2)
#Define tOldIO $$$vstrCommand(3)
#Define status $$$vstrCommand(4)
#Define stdiomode $$$vstrCommand(5)
#Define ex $$$vstrCommand(6)
#Define tStatement $$$vstrCommand(7)
#Define qStatus $$$vstrCommand(8)
#Define rset $$$vstrCommand(9)
#Define sc $$$vstrCommand(10)

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
				XECUTE ($$$NewList_" "_$$$vstrCommand)
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
