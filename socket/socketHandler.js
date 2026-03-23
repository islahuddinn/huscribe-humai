// import { Server } from 'socket.io';
// import { getRFQSocket, getRFQsByUserSocket, getQuotesByRfqSocket } from '../controllers/rfqController.js';
// import RFQ from '../models/rfqModel.js';
// import Quote from '../models/quoteModel.js';
// import mongoose from 'mongoose';

// const setupSocket = (server) => {
//     const origin = process.env.NODE_ENV === 'development'
//         ? "*"
//         : process.env.SOCKET_ALLOWED_ORIGINS.split(',');

//     const io = new Server(server, {
//         cors: {
//             origin,
//             methods: ["GET", "POST"],
//             credentials: origin !== "*"
//         }
//     });

//     // Watch for RFQ changes
//     const watchRFQChanges = async () => {
//         console.log('Setting up RFQ change stream...');

//         try {
//             const changeStream = RFQ.watch([], {
//                 fullDocument: 'updateLookup'
//             });

//             console.log('Change stream setup successful');

//             changeStream.on('change', async (change) => {
//                 console.log('Change detected:', change.operationType);

//                 try {
//                     if (change.operationType === 'insert') {
//                         // Get the fully populated document
//                         const populatedRfq = await RFQ.findById(change.fullDocument._id)
//                             .populate('user_id', 'name email');

//                         if (!populatedRfq) return;

//                         const userId = populatedRfq.user_id._id.toString();
//                         console.log('Populated RFQ:', populatedRfq);
//                         console.log('User ID for socket:', userId);

//                         // Find all sockets for this user
//                         const userSockets = Array.from(io.sockets.sockets.values())
//                             .filter(socket => {
//                                 console.log('Checking socket:', socket.id, 'userId:', socket.userId);
//                                 return socket.userId === userId;
//                             });

//                         console.log(`Found ${userSockets.length} sockets for user ${userId}`);

//                         // Emit to all sockets of this user
//                         userSockets.forEach(socket => {
//                             console.log(`Emitting to socket: ${socket.id}`);
//                             socket.emit('rfq:created', {
//                                 status: "ok",
//                                 data: populatedRfq
//                             });
//                         });
//                     }
//                 } catch (error) {
//                     console.error('Error processing change:', error);
//                 }
//             });

//             changeStream.on('error', (error) => {
//                 console.error('Change stream error:', error);
//                 setTimeout(watchRFQChanges, 5000);
//             });

//         } catch (error) {
//             console.error('Error setting up change stream:', error);
//             setTimeout(watchRFQChanges, 5000);
//         }
//     };

//     // Watch for Quote changes
//     const watchQuoteChanges = async () => {
//         console.log('Setting up Quote change stream...');

//         try {
//             const changeStream = Quote.watch([], {
//                 fullDocument: 'updateLookup'
//             });

//             console.log('Quote change stream setup successful');

//             changeStream.on('change', async (change) => {
//                 if (change.operationType === 'insert') {
//                     try {
//                         // Get the fully populated quote with exact structure
//                         const populatedQuote = await Quote.findById(change.fullDocument._id)
//                             .populate({
//                                 path: 'rfq_id',
//                                 select: 'supplier_type status _id user_id product_name product_category brand model description quantity delivery_location preferred_delivery_timeline supplier_list_name createdAt updatedAt __v',
//                                 populate: {
//                                     path: 'user_id',
//                                     select: '_id email'
//                                 }
//                             })
//                             .select('status contact_method _id rfq_id supplier_id quantity_requested quantity_available unit_price total_price delivery_location negotiation_history createdAt updatedAt __v');

//                         if (!populatedQuote) {
//                             console.error('Quote not found after creation');
//                             return;
//                         }

//                         // Add null checks for populated fields
//                         if (!populatedQuote.rfq_id || !populatedQuote.rfq_id.user_id) {
//                             console.error('Required relationships not populated:', {
//                                 hasRfq: !!populatedQuote.rfq_id,
//                                 hasUser: !!(populatedQuote.rfq_id && populatedQuote.rfq_id.user_id)
//                             });
//                             return;
//                         }

//                         const rfqOwnerId = populatedQuote.rfq_id.user_id._id.toString();
//                         const supplierId = populatedQuote.supplier_id ? populatedQuote.supplier_id.toString() : null;
//                         const rfqId = populatedQuote.rfq_id._id.toString();

//                         // Find all relevant sockets
//                         const relevantSockets = Array.from(io.sockets.sockets.values())
//                             .filter(socket => {
//                                 const isRelevant =
//                                     socket.userId === rfqOwnerId ||
//                                     (supplierId && socket.userId === supplierId) ||
//                                     socket.rfqWatching === rfqId;
//                                 return isRelevant;
//                             });

//                         // Prepare the response object in the exact format
//                         const responseData = {
//                             message: "Quote created successfully",
//                             status: "ok",
//                             data: populatedQuote
//                         };

//                         // Emit to all relevant sockets
//                         relevantSockets.forEach(socket => {
//                             if (socket.rfqWatching === rfqId) {
//                                 socket.emit('quotes:rfq-update', responseData);
//                             } else {
//                                 socket.emit('quote:created', responseData);
//                             }
//                         });
//                     } catch (error) {
//                         console.error('Error processing quote change:', error);
//                     }
//                 }
//             });

//             // Error handling
//             changeStream.on('error', (error) => {
//                 console.error('Quote change stream error:', error);
//                 setTimeout(watchQuoteChanges, 5000);
//             });

//         } catch (error) {
//             console.error('Error setting up quote change stream:', error);
//             setTimeout(watchQuoteChanges, 5000);
//         }
//     };

//     // Start watching both RFQ and Quote changes
//     watchRFQChanges().catch(error => {
//         console.error('Failed to start RFQ change stream:', error);
//     });

//     watchQuoteChanges().catch(error => {
//         console.error('Failed to start Quote change stream:', error);
//     });

//     io.on('connection', (socket) => {
//         console.log('Client connected:', socket.id);

//         socket.on('rfq:get-user-rfqs', async (userId) => {
//             console.log(`User ${userId} requesting RFQs on socket ${socket.id}`);
//             socket.userId = userId.toString();

//             // Get and send initial RFQs
//             try {
//                 const rfqs = await RFQ.find({ user_id: userId })
//                     .sort({ createdAt: -1 })
//                     .populate('user_id', 'name email');

//                 socket.emit('rfq:user-data', {
//                     status: "ok",
//                     count: rfqs.length,
//                     data: rfqs
//                 });
//             } catch (error) {
//                 socket.emit('rfq:error', {
//                     status: "error",
//                     message: error.message
//                 });
//             }
//         });

//         // Add this new handler for getting quotes by RFQ ID
//         socket.on('quotes:get-by-rfq', async (rfqId) => {
//             console.log(`Getting quotes for RFQ: ${rfqId} on socket ${socket.id}`);

//             try {
//                 const quotes = await Quote.find({ rfq_id: rfqId })
//                     .populate({
//                         path: 'rfq_id',
//                         select: 'supplier_type status _id user_id product_name product_category brand model description quantity delivery_location preferred_delivery_timeline supplier_list_name createdAt updatedAt __v',
//                         populate: {
//                             path: 'user_id',
//                             select: '_id email'
//                         }
//                     })
//                     .select('status contact_method _id rfq_id supplier_id quantity_requested quantity_available unit_price total_price delivery_location negotiation_history createdAt updatedAt __v')
//                     .sort({ createdAt: -1 });
//                 console.log('quotes', quotes)
//                 socket.emit('quotes:rfq-data', {
//                     message: "Quotes retrieved successfully",
//                     status: "ok",
//                     data: quotes
//                 });
//             } catch (error) {
//                 socket.emit('quotes:error', {
//                     status: "error",
//                     message: error.message
//                 });
//             }
//         });

//         // Also add a listener for quote updates for a specific RFQ
//         socket.on('quotes:watch-rfq', async (rfqId) => {
//             console.log(`Watching quotes for RFQ: ${rfqId} on socket ${socket.id}`);
//             socket.rfqWatching = rfqId; // Store the RFQ ID being watched
//         });

//         // Listen for unread quotes count requests
//         socket.on('quotes:get-unread-count', async (userId) => {
//             try {
//                 const unreadCount = await Quote.aggregate([
//                     {
//                         $lookup: {
//                             from: 'rfqs',
//                             localField: 'rfq_id',
//                             foreignField: '_id',
//                             as: 'rfq'
//                         }
//                     },
//                     {
//                         $match: {
//                             'rfq.user_id': new mongoose.Types.ObjectId(userId),
//                             $or: [
//                                 { is_read: false },
//                                 {
//                                     read_by: {
//                                         $not: {
//                                             $elemMatch: {
//                                                 user_id: new mongoose.Types.ObjectId(userId)
//                                             }
//                                         }
//                                     }
//                                 }
//                             ]
//                         }
//                     },
//                     {
//                         $count: 'total'
//                     }
//                 ]);

//                 socket.emit('quotes:unread-count', {
//                     status: 'ok',
//                     data: {
//                         count: unreadCount[0]?.total || 0
//                     }
//                 });
//             } catch (error) {
//                 socket.emit('quotes:error', {
//                     status: 'error',
//                     message: error.message
//                 });
//             }
//         });

//         // Listen for mark as read events
//         socket.on('quotes:mark-read', async ({ quoteId, userId }) => {
//             try {
//                 const quote = await Quote.findById(quoteId);
//                 if (!quote) {
//                     socket.emit('quotes:error', {
//                         status: 'error',
//                         message: 'Quote not found'
//                     });
//                     return;
//                 }

//                 const alreadyRead = quote.read_by.some(read =>
//                     read.user_id.toString() === userId.toString()
//                 );

//                 if (!alreadyRead) {
//                     // Update both is_read flag and read_by array
//                     quote.is_read = true;
//                     quote.read_by.push({
//                         user_id: userId,
//                         read_at: new Date()
//                     });
//                     await quote.save();

//                     // Emit updated unread count to all user's sockets
//                     const userSockets = Array.from(io.sockets.sockets.values())
//                         .filter(s => s.userId === userId.toString());

//                     // Use the same aggregation for consistency
//                     const newUnreadCount = await Quote.aggregate([
//                         {
//                             $lookup: {
//                                 from: 'rfqs',
//                                 localField: 'rfq_id',
//                                 foreignField: '_id',
//                                 as: 'rfq'
//                             }
//                         },
//                         {
//                             $match: {
//                                 'rfq.user_id': new mongoose.Types.ObjectId(userId),
//                                 $or: [
//                                     { is_read: false },
//                                     {
//                                         read_by: {
//                                             $not: {
//                                                 $elemMatch: {
//                                                     user_id: new mongoose.Types.ObjectId(userId)
//                                                 }
//                                             }
//                                         }
//                                     }
//                                 ]
//                             }
//                         },
//                         {
//                             $count: 'total'
//                         }
//                     ]);

//                     userSockets.forEach(s => {
//                         s.emit('quotes:unread-count', {
//                             status: 'ok',
//                             data: {
//                                 count: newUnreadCount[0]?.total || 0
//                             }
//                         });
//                     });
//                 }

//                 socket.emit('quotes:marked-read', {
//                     status: 'ok',
//                     message: 'Quote marked as read'
//                 });
//             } catch (error) {
//                 socket.emit('quotes:error', {
//                     status: 'error',
//                     message: error.message
//                 });
//             }
//         });

//         socket.on('disconnect', () => {
//             console.log('Client disconnected:', socket.id);
//             if (socket.userId) {
//                 console.log(`User ${socket.userId} disconnected from socket ${socket.id}`);
//             }
//             if (socket.rfqWatching) {
//                 console.log(`Stopped watching quotes for RFQ: ${socket.rfqWatching}`);
//             }
//         });
//     });

//     return io;
// };

// export default setupSocket; 