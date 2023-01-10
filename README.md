# iris-jupyter-server README

This is the README for the `intersystems-community.iris-jupyter-server` VS Code extension.

## Testing in a dev container

1. Clone this GitHub repo (intersystems-community/vscode-iris-jupyter-server).
2. Open the local folder in VS Code. If prompted, install recommended extensions.
3. When a notification appears, choose to "Reopen in Container". If it doesn't appear, click the "><" panel at the left end of the status bar and choose "Reopen in Container" from the quickpick that appears.
4. When "Starting Dev Container (show log)" notification appears, click on it to display progress.
5. If notified "Configuration file(s) changed", click "Rebuild"".
6. If notified "Git not found", click either "X" or "Don't Show Again" unless you intend using the dev container to make changes to the cloned repo.
7. If notified about application on port 1972, click "X".
8. When the dev container has finished starting, the "Configuring Dev Container (show log)" notification will disappear.
9. Use the Activity Bar to switch to "Run and Debug".
10. Start debugging with the "Run Extension" configuration.
11. The Extension Development Host (EDH) window opens after "Building..." has finished. If it notifies you "Configuration file(s) changed", click "Ignore". If any notification about app ports appears, click "X" to dismiss it.
12. In EDH's Explorer view, open the file `polyglot1.ipynb"
13. Click the Jupyter Server panel on the status bar. If the quickpick that appears already contains an entry `http://localhost:50773/devcontainer:user?token=` then select it. If not, choose `Existing`, then enter that URI when prompted. On the next prompt ("Change Server Display Name") just press Enter.
14. If the notebook displays "Select Kernel" in the top right, click it and choose the `Polyglot IRIS` entry.
15. Click the "Run All" button. You should see an output cell appear underneath each of the three code cells.

