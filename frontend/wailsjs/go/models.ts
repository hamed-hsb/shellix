export namespace main {
	
	export class CreateSessionRequest {
	    shell: string;
	    cwd: string;
	    cols: number;
	    rows: number;
	
	    static createFrom(source: any = {}) {
	        return new CreateSessionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.shell = source["shell"];
	        this.cwd = source["cwd"];
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	    }
	}
	export class SSHSessionRequest {
	    host: string;
	    port: number;
	    user: string;
	    password: string;
	    privateKeyPem: string;
	    passphrase: string;
	    cols: number;
	    rows: number;
	
	    static createFrom(source: any = {}) {
	        return new SSHSessionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.privateKeyPem = source["privateKeyPem"];
	        this.passphrase = source["passphrase"];
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	    }
	}
	export class TelnetSessionRequest {
	    host: string;
	    port: number;
	    cols: number;
	    rows: number;
	
	    static createFrom(source: any = {}) {
	        return new TelnetSessionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.port = source["port"];
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	    }
	}

}

