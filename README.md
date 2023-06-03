# iris-jupyter-server

This VS Code extension is an alpha-quality proof-of-concept. Leveraging the [Jupyter extension from Microsoft](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter) it brings the notebook paradigm to developers working with InterSystems IRIS servers (local or remote).

## Getting Started

1. Install the [InterSystems ObjectScript Extension Pack](https://marketplace.visualstudio.com/items?itemName=intersystems-community.objectscript-pack).
2. Use the [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager) to define a connection to your IRIS server, which can be running locally on your workstation or remotely.
3. From VS Code's `File` menu select `New File...`.
4. From the quickpick choose `Jupyter Notebook`.
5. If a notification from the Jupyter extension warns you that `Connecting over HTTP without a token may be an insecure connection`, choose `Yes` or `Do not show again`.
6. Click the `Detecting Kernels` button in the upper right of the notebook.
7. In the quickpick titled "Select Kernel" choose `Existing Jupyter Server...`.
8. In the next quickpick ("Select a Jupyter Server") choose `Enter the URL of the running Jupyter server`.
9. Enter `http://localhost:50773/`_servername_`:`_namespace_`?token=` when prompted. Replace _servername_ with the name of the Server Manager definition you previously created. Replace _namespace_ with the target namespace on that server. Do not omit the colon between these two elements. For example `http://localhost:50773/iris231:USER?token=`
10. On the next prompt ("Change Server Display Name") enter a suitable name, for example `IRIS231 USER`. Don't leave this blank, else the display name will default to `localhost`, meaning you won't be able to distinguish between entries you create for different _servername_:_namespace_ combinations. 
11. When you connect to a namespace for the first time you will be asked to allow the installation of a support class named `PolyglotKernel.CodeExecutor`. Choose `Yes`.
> **Tip:** To avoid having to load this class into other namespaces on the same server you can add a %ALL package mapping of the `PolyglotKernel` package to the default code database of the namespace you initially connected to.
12. On the kernel selector, choose the `IRIS ObjectScript INT` kernel.
13. The kernel indicator in the upper right of the notebook will display your choice, and the initial notebook cell will show the corresponding language (ObjectScript INT) in the lower right corner.
14. Starting with a single-space indent, enter an ObjectScript command in the cell, e.g. `write $zversion,!,$namespace,!,$job,!` and click the Execute Cell button on the left. The output from the command will appear below the cell.
> **Note:** If you forget to start the line with a space it won't be syntax-colored correctly but it will still execute.
15. Cells can contain more than one line of code, so the above example could be rewritten as:
```objectscript
 write $zversion,!
 write $namespace,!
 write $job,!
``` 

## Next Steps

- Create another .ipynb notebook, select the same Jupyter server, then pick the `IRIS SQL` kernel. Use cells to run SQL statements, for example:
```sql
SELECT 123 AS One, 456 AS Two
```
- In another notebook choose the `IRIS Python` kernel and run some Python code inside IRIS ('IRIS Embedded Python'), for example:
```python
print('Hello world')
```
- Try the `Polyglot IRIS` kernel. Begin each cell with a 'magic' line to indicate what language you are scripting in:
	- `%%objectscript`
	- `%%python`
	- `%%sql`
	
> **Note:** Cells of a Polyglot IRIS notebook are not language-aware, so they lack syntax coloring, completions etc. The so-called 'cell magics' tell the server-side code executor class which language to run, but the Jupyter notebook extension we are leveraging is not currently able to use them to vary the cell language in the editor.

## Feedback

Please open issues at https://github.com/intersystems-community/vscode-iris-jupyter-server/issues

The [InterSystems Developer Community](https://community.intersystems.com/) is also a good place for discussing this extension.
