// Stored ZIP entries: small evidence bundles need no archive dependency or compression worker.
export function zipFiles(files:{name:string,data:Buffer}[]){
 const table=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=(b:Buffer)=>{let c=0xffffffff;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const file of files){if(file.name.includes('..')||file.name.startsWith('/')||file.name.includes('\\'))throw Error('Invalid archive entry');const name=Buffer.from(file.name),header=Buffer.alloc(30),dir=Buffer.alloc(46),sum=crc(file.data);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt32LE(sum,14);header.writeUInt32LE(file.data.length,18);header.writeUInt32LE(file.data.length,22);header.writeUInt16LE(name.length,26);dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(0x800,8);dir.writeUInt32LE(sum,16);dir.writeUInt32LE(file.data.length,20);dir.writeUInt32LE(file.data.length,24);dir.writeUInt16LE(name.length,28);dir.writeUInt32LE(offset,42);local.push(header,name,file.data);central.push(dir,name);offset+=header.length+name.length+file.data.length;}
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
