/* eslint-disable @typescript-eslint/semi */
/* eslint-disable eqeqeq */
var native = null;

if (process.platform == "win32" && process.arch == "x64") {
        // winx64
	native = require('./bin/winx64/irisnative.node');
/*
} else if (process.platform == "win32" && process.arch == "ia32") {
	native = require('./bin/winx86/irisnative.node');
*/
} else if (process.platform == "darwin") {
    native = require('./bin/macx64/irisnative.node');
} else if (process.platform == "linux") {
    let distro = getLinuxDistro()
    logChannel.debug('platform = ' + process.platform + ': ' + distro + ': ' + process.arch);
    if (distro == 'ubuntu') {
        if (process.arch == "x64") {
            native = require('./bin/lnxubuntux64/irisnative.node');
        }
		/*
        else { // presumed ARM64 if linux not x64
            native = require('./bin/lnxubuntuarm64/irisnative.node');
        }
    } else if (distro == 'fedora') {
        native = require('./bin/lnxrhx64/irisnative.node');
    } else if (distro == 'rhx64') {
        native = require('./bin/lnxrhx64/irisnative.node');
    } else if (distro == 'rhel' && process.arch == 'arm64') {
        native = require('./bin/lnxrharm64/irisnative.node');
    } else {
        // default to RH for now
        native = require('./bin/lnxrhx64/irisnative.node');
	*/
    }
}

function getLinuxDistro() {
    const { execSync } = require('child_process');
    try {
        let distro = execSync('lsb_release -is',{encoding:'utf8',stdio:'pipe'});
        return distro.replace(/(\r\n\t|\n|\r\t)/gm,"").toLowerCase();
    } catch (e) {
        return getDistroFromFile();
    }
}

function getDistroFromFile() {
    const fs = require('fs')
    try {
        let osv = fs.readFileSync('/etc/os-release','utf8');
        let lines = osv.split('\n');
        let distro = lines.find((element) => { return element.substring(0,element.indexOf('=')) == 'ID' })
        return distro.substring(3).replace(/["]+/g,'');
    } catch (e) {
        return null;
    }
}

module.exports = native;

/**
 * The InterSystems IRIS Native API Module.
 * @external "intersystems-iris-native"
 */

/**
 * @typedef {Object} connectionInfo
 * @property {string} host - the host address
 * @property {integer} port - the port number
 * @property {string} ns - the IRIS Namespace
 * @property {string} user - user name
 * @property {string} pwd - password
 * @property {boolean} sharedmemory - use shared memory if available, default is true
 */

/**
 * An IRIS Native function to establish a connection to an InterSystems IRIS Server. This method returns an instance of Connection.
 * @function external:"intersystems-iris-native".createConnection
 * @param {connectionInfo} connectionInfo - Object containing connection arguments host, port, namespace, user, password, and sharedmemory
 * @returns {external:"intersystems-iris-native".Connection}
 */

/**
 * IRIS Native Connection Class
 * @class Connection
 * @memberof external:"intersystems-iris-native"
 * @hideconstructor

 */

 /**
 * Close the connection to the IRIS server.
 * @function close
 * @memberof external:"intersystems-iris-native".Connection
 * @instance
 */

/**
 * Create an instance of the Iris class. Returns an instance of Iris.
 * @function createIris
 * @returns {external:"intersystems-iris-native".Iris}
 * @memberof external:"intersystems-iris-native".Connection
 * @instance
 */

 /**
 * Check connection status, returns true if the connection is closed, false otherwise.
 * @function isClosed
 * @memberof external:"intersystems-iris-native".Connection
 * @returns {boolean}
 * @instance
 */

 /**
 * IRIS Native IRIS Class
 * @class Iris
 * @memberof external:"intersystems-iris-native"
 * @hideconstructor
 */

/**
 * Get the value of a global array node, returns null if the node is not defined.
 * @function get
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {any}
 * @throws exception
 * @instance
 */

 /**
 * Get the boolean value of a global array node, returns null if the node is not defined.
 * @function getBoolean
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {boolean}
 * @throws exception
 * @instance
 */

 /**
 * Get the value of a global array node as an ArrayBuffer, returns null if the node is not defined.
 * @function getBytes
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {ArrayBuffer}
 * @throws exception
 * @instance
 */

 /**
 * Get the value of a global array node as an IRISList, returns null if the node is not defined.
 * @function getList
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {external:"intersystems-iris-native".IRISList}
 * @throws exception
 * @instance
 */

 /**
 * Get the API version string as major.minor.patch
 * @function getAPIVersion
 * @memberof external:"intersystems-iris-native".Iris
 * @returns {string}
 * @throws exception
 * @instance
 */

 /**
 * Get the numeric value of a global array node, returns null if the node is not defined.
 * @function getNumber
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {number}
 * @throws exception
 * @instance
 */

 /**
 * Get the next $order subscript value of a global array node as a String, returns null if at the end.
 * @function nextSubscript
 * @memberof external:"intersystems-iris-native".Iris
 * @param {boolean} reversed - if true, reverse $order
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {string}
 * @throws exception
 * @instance
 */

 /**
 * Get the IRIS Server's version string.
 * @function getServerVersion
 * @memberof external:"intersystems-iris-native".Iris
 * @returns {string}
 * @throws exception
 * @instance
 */

 /**
 * Get the value of a global array node as a string, returns null if the node is not defined.
 * @function getString
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {string}
 * @throws exception
 * @instance
 */

 /**
 * Set the value of a global array node.
 * @function set
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string|number|true|false|NULL} value - the value to assign to the global array
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @throws exception
 * @instance
 */

 /**
 * Call a method in a class that returns a value that is an IRISList.
 * @function classMethodIRISList
 * @memberof external:"intersystems-iris-native".Iris
 * @oaram {string} className - the name of the class in which the method is implemented
 * @param {string} methodName - the name of the method to call
 * @param {...any} argument - arguments to pass to the method, zero one or more.
 * @returns {external:"intersystems-iris-native".IRISList} - the class method's return value
 * @throws exception
 * @instance
 */

 /**
 * Call a method in a class that returns a value.
 * @function classMethodValue
 * @memberof external:"intersystems-iris-native".Iris
 * @oaram {string} className - the name of the class in which the method is implemented
 * @param {string} methodName - the name of the method to call
 * @param {...any} argument - arguments to pass to the method, zero one or more.
 * @returns {any} - the class method's return value
 * @throws exception
 * @instance
 */

 /**
 * Call a method in a class without returning a value.
 * @function classMethodVoid
 * @oaram {string} className - the name of the class in which the method is implemented
 * @param {string} methodName - the name of the method to call
 * @param {...any} argument - arguments to pass to the method, zero one or more.
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Invoke a function in a routine.
 * @function function
 * @param {string} routineName - the name of the routine in which the function is implemented
 * @param {string} functionName - the name of the function to invoke
 * @param {...any} argument - zero, one or more arguments to pass to the function
 * @returns {any} - the function's return value
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Invoke a function in a routine that returns an IRISList.
 * @function functionList
 * @param {string} routineName - the name of the routine in which the function is implemented
 * @param {string} functionName - the name of the function to invoke
 * @param {...any} argument - zero, one or more arguments to pass to the function
 * @returns {external:"intersystems-iris-native".IRISList} - the function's return value
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Invoke a procedure (no value is returned) in a routine.
 * @function procedure
 * @param {string} routineName - the name of the routine in which the procedure is implemented
 * @param {string} procedureName - the name of the procedure to invoke
 * @param {...any} argument - zero, one or more arguments to pass to the procedure
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Increment the value of a global array node.
 * @function increment
 * @param {number} incrementBy - the amount to increment the global array node by
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {number}
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Check to see if a global array node is defined.
 * @function isDefined
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {number} - 0 if the global array node is not defined, 1 if it is defined and has no subordinate nodes, 10 if not defined but has subordinate nodes, 11 if defined and has subordinate nodes.
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Kill a global array node.
 * @function kill
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Lock a global array. The lockMode argument specifies whether any previously held locks should be released.
 * This method will time out after a predefined interval if the lock cannot be acquired.
 * NOTE: The lockReference value must begin with '^' to acquire a lock on a global node.
 * @function lock
 * @param {string} lockType - 'S' for shared lock and 'E' for an escalating lock
 * @param {integer} timeout - the number of seconds before the attempt to acquire the lock will timeout
 * @param {string} lockReference -  a leading '^' is required for global array references.  Note that lock() and unlock() are different from all other functions. where only a globalName - without the '^' prefix - is required.
 * @param {...string} subscript
 * @returns {boolean}
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Rrelease a previously acquired lock on *lockReference.
 * @function unlock
 * @param {string} lockMode - a string containing lock type ('S' or 'E') and 'I' for an immediate unlock or 'D' for deferred
 * @param {string} lockReference -  a leading '^' is required for global array references.  Note that lock() and unlock() are different from all other functions. where only a globalName - without the '^' prefix - is required.
 * @param {...string} subscript
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Release all global array locks held by the connection.
 * @function releaseAllLocks
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Start a new server transaction.
 * @function tStart
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Commit one level of a server transaction.
 * @function tCommit
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Rollback all levels of the server transaction.
 * @function tRollback
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Rollback one level of the server transaction.
 * @function tRollbackOne
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Get the nesting level of the current server transaction.
 * @function getTLevel
 * @returns {number} - the nesting level of the current server transaction, 0 if no transaction is active
 * @memberof external:"intersystems-iris-native".Iris
 * @instance
 */

 /**
 * Instantiate the Iterator class.
 * @function iterator
 * @memberof external:"intersystems-iris-native".Iris
 * @param {string} globalName - the name of the global array
 * @param {...string} subscript - variable number of subscript values
 * @returns {external:"intersystems-iris-native".Iterator}
 * @throws exception
 * @instance
 */

/**
 * IRIS Native IRIS Class
 * @class Iterator
 * @memberof external:"intersystems-iris-native"
 * @hideconstructor
*/

/**
 * Position the iterator at the next sibling node in collation order and return an object containing done and value properties.
 * If the iterator is at end then done is true, otherwise it is false. The value property returned when done is false is either the subscript,
 * the node value, or an array whose first element is the subscript and the second is the global node value. The return value type
 * defaults to the array containing the subscript and value. The return type can be changed by invoking the entries(), keys(), or values() methods.
 * @function next
 * @returns {any}
 * @memberof external:"intersystems-iris-native".Iterator
 * @instance
*/

/**
 * Position the iterator to start from subscript, returns this() for chaining.
 * @function startFrom
 * @param {string} subscript - the value of the subscript where the iterator is to be positioned
 * @returns {external:"intersystems-iris-native".Iterator}
 * @memberof external:"intersystems-iris-native".Iterator
 * @instance
*/

/**
 * reverse the iterator, returns this() for chaining.
 * @function reversed
 * @returns {external:"intersystems-iris-native".Iterator}
 * @memberof external:"intersystems-iris-native".Iterator
 * @instance
*/

/**
 * set the iterator return type to return entries where each value is an array containing the subscript and node value, returns This() for chaining.
 * @function entries
 * @returns {external:"intersystems-iris-native".Iterator}
 * @memberof external:"intersystems-iris-native".Iterator
 * @instance
*/

/**
 * set the iterator return type to return keys only (subscripts), returns this() for chaining.
 * @function keys
 * @returns {external:"intersystems-iris-native".Iterator}
 * @memberof external:"intersystems-iris-native".Iterator
 * @instance
*/

/**
 * set the iterator return type to return only values, returns this() for chaining.
 * @function values
 * @returns {external:"intersystems-iris-native".Iterator}
 * @memberof external:"intersystems-iris-native".Iterator
 * @instance
*/

/**
 * IRIS Native IRISList Class
 * @class IRISList
 * @memberof external:"intersystems-iris-native"
*/

/**
 * Add a new list element to the end of the list.
 * @function add
 * @param {string} value - the value of the list element to be added
 * @returns {null}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/

/**
 * Clear all elements from the list.
 * @function clear
 * @returns {null}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/
/**
 * Return a the number of elements currently in the list.
 * @function count
 * @returns {number}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/

/**
 * Compare a list to the current list, return true if they are equal.
 * @function equals
 * @param {external:"intersystems-iris-native".IRISList} compareTo - the list to compare the current list to
 * @returns {boolean}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/
/**
 * Get the list element at the specified index. If the element value is expected to
 * be a list then use getList instead.
 * @function get
 * @param {number} index - the element position to retrieve
 * @returns {any}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/

/**
 * Get the entire contents of the current list as a buffer.
 * @function getBuffer
 * @returns {ArrayBuffer}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/

 /**
 * Get the element at the specified index as a list value.
 * @function getList
 * @param {number} index - the element position to retrieve
 * @returns {external:"intersystems-iris-native".IRISList}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/
/**
 * Remove the list element at the specified index from the list.
 * @function remove
 * @param {number} index - the element position to retrieve
 * @returns {boolean}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/
/**
 * Set the list element at the specified index to a new value.
 * @function set
 * @param {number} index - the element position to set
 * @param {any} value - the element value
 * @returns {null}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/
/**
 * Return the total size (number of bytes) of the list.
 * @function size
 * @returns {number}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/
/**
 * Return a string containing the formatted list value
 * @function toString
 * @returns {string}
 * @memberof external:"intersystems-iris-native".IRISList
 * @instance
*/
