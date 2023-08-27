const FTDI = require('ftdi-d2xx')

async function get() {
    try {
        // Get the connected devices info list 
        const list = await FTDI.getDeviceInfoList();
        console.log(`${list.length} device${list.length>1?'s':''} found:`, list);
        
        // If there is at least one device connected
        if(list.length) {
      
          // Try to open the first device from the list
          device = await FTDI.openDevice("A");
          console.log(`One device open:`, device);
    
          // Setup the device
          device.setTimeouts(1000, 1000); // set the max TX and RX duration in ms
          device.purge(FTDI.FT_PURGE_RX); // purge the RX buffer from previous received data
          device.setBitMode(0x00, 0x02)
          //device.setBaudRate(115200); // set the UART baud rate (bits per second)
          //device.setDataCharacteristics(FTDI.FT_BITS_8, FTDI.FT_STOP_BITS_1, FTDI.FT_PARITY_NONE);
      
          // Send data from the TXD pin of the device
          await device.write(Uint8Array.from([0xAA]));
          console.log(`Data sent successfully.`);
      
          // Wait to receive from the RXD pin
          console.log(`Trying to receive data...`);
          const response = await device.read(2); // expected response byte length
          console.log(`${response.byteLength} bytes were received:`, response);
    
          // Close the device (device object must then be recreated using openDevice)
          device.close();
    
          // Be careful "not to loose" the device object before closing it, otherwise
          // the device will likely stay open and you will not be able to re-open it.
        }
      } catch (e) {
        console.error(e);
      }
}