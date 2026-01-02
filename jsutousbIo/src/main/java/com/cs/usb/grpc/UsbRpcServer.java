package com.cs.usb.grpc;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.stub.StreamObserver;
import java.io.IOException;

// Direct Thesycon Driver Access for Minimal Footprint
// Requires the Thesycon UsbIo library on the classpath
import de.thesycon.usbio.UsbIo;
import de.thesycon.usbio.UsbIoPipe;
import de.thesycon.usbio.structs.USBIO_CONFIGURATION_INFO;
import de.thesycon.usbio.structs.USBIO_DATA_BUFFER;
import de.thesycon.usbio.structs.USBIO_INTERFACE_SETTING;
import de.thesycon.usbio.structs.USBIO_SET_CONFIGURATION;
import de.thesycon.usbio.structs.USB_DEVICE_DESCRIPTOR;

public class UsbRpcServer {
    private Server server;

    // Constants from the original driver (CSUSB310.java)
    private final String GUID = "{325ddf96-938c-11d3-9e34-0080c82727f4}";
    private final int DS300_PID = 0x0640;
    private final int S331_PID = 0x0646;
    private final int DS300_VID = 0x16c0;

    // Status constants
    private static final long USBIO_ERR_SUCCESS = 0x00000000L;
    private static final long USBIO_ERR_ALREADY_CONFIG = -536866811; // 0xE0000005

    private void start() throws IOException {
        int port = 50051;
        server = ServerBuilder.forPort(port)
                .addService(new UsbDriverServiceImpl())
                .build()
                .start();
        System.out.println("Minimal USB Server started, listening on " + port);
        Runtime.getRuntime().addShutdownHook(new Thread() {
            @Override
            public void run() {
                System.err.println("*** shutting down gRPC server since JVM is shutting down");
                UsbRpcServer.this.stop();
                System.err.println("*** server shut down");
            }
        });
    }

    private void stop() {
        if (server != null) {
            server.shutdown();
        }
    }

    private void blockUntilShutdown() throws InterruptedException {
        if (server != null) {
            server.awaitTermination();
        }
    }

    public static void main(String[] args) throws IOException, InterruptedException {
        final UsbRpcServer server = new UsbRpcServer();
        server.start();
        server.blockUntilShutdown();
    }

    class UsbDriverServiceImpl extends UsbDriverServiceGrpc.UsbDriverServiceImplBase {
        // Driver State
        private UsbIo myUsbIo;
        private UsbIoPipe myPipeIn;
        private UsbIoPipe myPipeOut;
        private boolean initialized = false;
        private int gDevList = 0;

        @Override
        public synchronized void connect(ConnectRequest req, StreamObserver<ConnectResponse> responseObserver) {
            boolean success = false;
            String message = "";

            if (initialized) {
                success = true;
                message = "Already Initialized";
            } else {
                try {
                    myUsbIo = new UsbIo();
                    myPipeIn = new UsbIoPipe();
                    myPipeOut = new UsbIoPipe();

                    gDevList = UsbIo.createDeviceList(GUID);
                    boolean openSuccess = false;
                    int devNo = 0;

                    // 1. Scan and Open
                    for (int i = 0; i < 128; i++) {
                        int status = myUsbIo.open(i, gDevList, GUID);
                        if (status == USBIO_ERR_SUCCESS) {
                            USB_DEVICE_DESCRIPTOR desc = new USB_DEVICE_DESCRIPTOR();
                            myUsbIo.getDeviceDescriptor(desc);

                            if (desc.idVendor == DS300_VID
                                    && (desc.idProduct == DS300_PID || desc.idProduct == S331_PID)) {
                                devNo = i;
                                openSuccess = true;
                                break;
                            }
                            myUsbIo.close();
                        }
                    }

                    if (!openSuccess) {
                        message = "Device Not Found";
                    } else {
                        // 2. Set Configuration
                        USBIO_SET_CONFIGURATION conf = new USBIO_SET_CONFIGURATION();
                        // Try Config 0 (2 interfaces) first as per original code
                        conf.ConfigurationIndex = 0;
                        conf.NbOfInterfaces = 2;
                        conf.InterfaceList[0] = new USBIO_INTERFACE_SETTING();
                        conf.InterfaceList[0].InterfaceIndex = 0;
                        conf.InterfaceList[0].MaximumTransferSize = 65536;
                        conf.InterfaceList[1] = new USBIO_INTERFACE_SETTING();
                        conf.InterfaceList[1].InterfaceIndex = 1;
                        conf.InterfaceList[1].MaximumTransferSize = 65536;

                        int status = myUsbIo.setConfiguration(conf);
                        if (status != USBIO_ERR_SUCCESS && status != USBIO_ERR_ALREADY_CONFIG) {
                            // Fallback to Config 1 (1 interface)
                            conf.ConfigurationIndex = 1;
                            conf.NbOfInterfaces = 1;
                            status = myUsbIo.setConfiguration(conf);
                            if (status != USBIO_ERR_SUCCESS && status != USBIO_ERR_ALREADY_CONFIG) {
                                throw new Exception("SetConfiguration Failed: " + status);
                            }
                        }

                        // 3. Bind Pipes
                        USBIO_CONFIGURATION_INFO info = new USBIO_CONFIGURATION_INFO();
                        if (myUsbIo.getConfigurationInfo(info) == USBIO_ERR_SUCCESS) {
                            for (int i = 0; i < info.NbOfPipes; i++) {
                                byte ep = info.PipeInfo[i].EndpointAddress;
                                int type = info.PipeInfo[i].PipeType;
                                // Bulk IN (0x80 | 2)
                                if (((ep & 0x80) == 0x80) && (type == 2)) {
                                    if (myPipeIn.bind(devNo, ep, gDevList, GUID) != USBIO_ERR_SUCCESS) {
                                        throw new Exception("Bind PipeIn Failed");
                                    }
                                }
                                // Bulk OUT (type == 2)
                                else if (type == 2) {
                                    if (myPipeOut.bind(devNo, ep, gDevList, GUID) != USBIO_ERR_SUCCESS) {
                                        throw new Exception("Bind PipeOut Failed");
                                    }
                                }
                            }
                            initialized = true;
                            success = true;
                        } else {
                            message = "GetConfigurationInfo Failed";
                        }
                    }
                } catch (Exception e) {
                    message = "Exception: " + e.getMessage();
                    cleanup();
                }
            }

            ConnectResponse reply = ConnectResponse.newBuilder()
                    .setSuccess(success)
                    .setErrorMessage(message)
                    .build();
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        }

        @Override
        public void disconnect(Empty req, StreamObserver<StatusResponse> responseObserver) {
            cleanup();
            StatusResponse reply = StatusResponse.newBuilder().setSuccess(true).build();
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        }

        @Override
        public void ping(Empty req, StreamObserver<StatusResponse> responseObserver) {
            StatusResponse reply = StatusResponse.newBuilder().setSuccess(true).build();
            responseObserver.onNext(reply);
            responseObserver.onCompleted();
        }

        @Override
        public synchronized void sendCommand(CommandRequest req, StreamObserver<CommandResponse> responseObserver) {
            if (!initialized) {
                responseObserver.onNext(
                        CommandResponse.newBuilder().setSuccess(false).setErrorMessage("Not Connected").build());
                responseObserver.onCompleted();
                return;
            }

            byte[] cmd = req.getData().toByteArray();
            int expectedSize = req.getExpectedResponseSize();
            byte[] responseData = new byte[0];
            boolean success = false;
            String error = "";

            try {
                // Write
                USBIO_DATA_BUFFER bufSend = new USBIO_DATA_BUFFER(cmd.length);
                for (int i = 0; i < cmd.length; i++)
                    bufSend.Buffer()[i] = cmd[i];
                bufSend.setNumberOfBytesToTransfer(cmd.length);

                int status = myPipeOut.writeSync(bufSend, 1000); // 1s timeout
                if (status == USBIO_ERR_SUCCESS) {
                    // Read
                    USBIO_DATA_BUFFER bufRead = new USBIO_DATA_BUFFER(expectedSize);
                    bufRead.setNumberOfBytesToTransfer(expectedSize);

                    // 3s Read Timeout (matches original code)
                    status = myPipeIn.readSync(bufRead, 3000);
                    if (status == USBIO_ERR_SUCCESS) {
                        responseData = new byte[bufRead.getBytesTransferred()];
                        System.arraycopy(bufRead.Buffer(), 0, responseData, 0, bufRead.getBytesTransferred());
                        success = true;
                    } else {
                        error = "Read Failed: " + status;
                    }
                } else {
                    error = "Write Failed: " + status;
                }
            } catch (Exception e) {
                error = "Exception: " + e.getMessage();
                // cleanup(); // Don't cleanup on single command failure unless critical
            }

            CommandResponse.Builder builder = CommandResponse.newBuilder()
                    .setSuccess(success)
                    .setErrorMessage(error)
                    .setData(com.google.protobuf.ByteString.copyFrom(responseData));

            responseObserver.onNext(builder.build());
            responseObserver.onCompleted();
        }

        private void cleanup() {
            try {
                if (myPipeIn != null)
                    myPipeIn.close();
                if (myPipeOut != null)
                    myPipeOut.close();
                if (myUsbIo != null)
                    myUsbIo.close();
                // UsbIo.destroyDeviceList(gDevList); // Optional based on original code usage
            } catch (Exception e) {
            }
            initialized = false;
        }
    }
}
