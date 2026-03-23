import axios from 'axios';
import asyncHandler from 'express-async-handler';
import dotenv from "dotenv";

dotenv.config();

////== Monday.com API configuration
const MONDAY_API_URL = process.env.MONDAY_API_URL;
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET;
const MONDAY_REDIRECT_URI = process.env.MONDAY_REDIRECT_URI;

// Helper function for GraphQL requests
const mondayRequest = async (query, token) => {
    try {
        const response = await axios.post(MONDAY_API_URL, 
            { query },
            {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                }
            }
        );
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error_description || error.message);
    }
};

// Auth Controllers
export const authenticateMonday = asyncHandler(async (req, res) => {
    const authUrl = `${process.env.MONDAY_OAUTH_URL}?client_id=${MONDAY_CLIENT_ID}&redirect_uri=${MONDAY_REDIRECT_URI}`;
    res.redirect(authUrl);
});

export const getMondayCallback = asyncHandler(async (req, res) => {
    const { code } = req.query;
    
    try {
        const response = await axios.post(process.env.MONDAY_TOKEN_URL, {
            client_id: MONDAY_CLIENT_ID,
            client_secret: MONDAY_CLIENT_SECRET,
            code,
            redirect_uri: MONDAY_REDIRECT_URI
        });

        // Store token in user's session or database
        const accessToken = response.data.access_token;
        
        res.json({ success: true, token: accessToken });
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
    }
});

// Board Controllers
export const getBoards = asyncHandler(async (req, res) => {
    const query = `
        query {
            boards {
                id
                name
                description
                state
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.boards);
});

export const createBoard = asyncHandler(async (req, res) => {
    const { name, boardKind } = req.body;
    
    const query = `
        mutation {
            create_board(board_name: "${name}", board_kind: ${boardKind}) {
                id
                name
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.create_board);
});

export const updateBoard = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const query = `
        mutation {
            update_board(board_id: ${id}, board_attribute: "name", new_value: "${name}") {
                id
                name
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.update_board);
});

export const deleteBoard = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const query = `
        mutation {
            delete_board(board_id: ${id}) {
                id
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json({ message: 'Board deleted successfully' });
});

// Item Controllers
export const getItems = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    
    const query = `
        query {
            boards(ids: ${boardId}) {
                items {
                    id
                    name
                    column_values {
                        id
                        value
                        text
                    }
                }
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.boards[0].items);
});

export const createItem = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { itemName, columnValues } = req.body;
    
    const query = `
        mutation {
            create_item(
                board_id: ${boardId},
                item_name: "${itemName}",
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) {
                id
                name
                column_values {
                    id
                    value
                    text
                }
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.create_item);
});

export const updateItem = asyncHandler(async (req, res) => {
    const { boardId, itemId } = req.params;
    const { columnValues } = req.body;
    
    const query = `
        mutation {
            change_multiple_column_values(
                board_id: ${boardId},
                item_id: ${itemId},
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) {
                id
                name
                column_values {
                    id
                    value
                    text
                }
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.change_multiple_column_values);
});

export const deleteItem = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    
    const query = `
        mutation {
            delete_item(item_id: ${itemId}) {
                id
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json({ message: 'Item deleted successfully' });
});

// Column Controllers
export const getColumns = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    
    const query = `
        query {
            boards(ids: ${boardId}) {
                columns {
                    id
                    title
                    type
                }
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.boards[0].columns);
});

export const createColumn = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { title, columnType } = req.body;
    
    const query = `
        mutation {
            create_column(
                board_id: ${boardId},
                title: "${title}",
                column_type: "${columnType}"
            ) {
                id
                title
                type
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.create_column);
});

export const updateColumn = asyncHandler(async (req, res) => {
    const { boardId, columnId } = req.params;
    const { title } = req.body;
    
    const query = `
        mutation {
            change_column_title(
                board_id: ${boardId},
                column_id: "${columnId}",
                title: "${title}"
            ) {
                id
                title
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.change_column_title);
});

export const deleteColumn = asyncHandler(async (req, res) => {
    const { boardId, columnId } = req.params;
    
    const query = `
        mutation {
            delete_column(
                board_id: ${boardId},
                column_id: "${columnId}"
            ) {
                id
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json({ message: 'Column deleted successfully' });
});

// Group Controllers
export const getGroups = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    
    const query = `
        query {
            boards(ids: ${boardId}) {
                groups {
                    id
                    title
                }
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.boards[0].groups);
});

export const createGroup = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { groupName } = req.body;
    
    const query = `
        mutation {
            create_group(
                board_id: ${boardId},
                group_name: "${groupName}"
            ) {
                id
                title
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.create_group);
});

export const updateGroup = asyncHandler(async (req, res) => {
    const { boardId, groupId } = req.params;
    const { newTitle } = req.body;
    
    const query = `
        mutation {
            update_group(
                board_id: ${boardId},
                group_id: "${groupId}",
                group_attribute: "title",
                new_value: "${newTitle}"
            ) {
                id
                title
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.update_group);
});

export const deleteGroup = asyncHandler(async (req, res) => {
    const { boardId, groupId } = req.params;
    
    const query = `
        mutation {
            delete_group(
                board_id: ${boardId},
                group_id: "${groupId}"
            ) {
                id
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json({ message: 'Group deleted successfully' });
});

// User Controllers
export const getUsers = asyncHandler(async (req, res) => {
    const query = `
        query {
            users {
                id
                name
                email
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.users);
});

// Workspace Controllers
export const getWorkspaces = asyncHandler(async (req, res) => {
    const query = `
        query {
            workspaces {
                id
                name
                kind
            }
        }
    `;
    
    const data = await mondayRequest(query, req.headers.authorization);
    res.json(data.data.workspaces);
});

export const performBatchOperations = asyncHandler(async (req, res) => {
    const { operations } = req.body;
    const results = {};

    try {
        // Process board operations
        if (operations.board) {
            const boardOp = operations.board;
            
            if (boardOp.action === 'create') {
                // Create board
                const query = `
                    mutation {
                        create_board(
                            board_name: "${boardOp.name}"
                            board_kind: public
                        ) {
                            id
                            name
                        }
                    }
                `;
                const boardData = await mondayRequest(query, req.headers.authorization);
                results.board = boardData.data.create_board;
                const boardId = results.board.id;

                // Create columns with delay to avoid rate limiting
                if (boardOp.columns && boardOp.columns.length > 0) {
                    results.columns = [];
                    for (const column of boardOp.columns) {
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay
                            const columnQuery = `
                                mutation {
                                    create_column(
                                        board_id: ${boardId}
                                        title: "${column.title}"
                                        column_type: ${column.type}
                                    ) {
                                        id
                                        title
                                        type
                                    }
                                }
                            `;
                            const columnData = await mondayRequest(columnQuery, req.headers.authorization);
                            results.columns.push(columnData.data.create_column);
                        } catch (columnError) {
                            console.error('Column creation error:', columnError);
                            results.columns.push({
                                error: `Failed to create column ${column.title}: ${columnError.message}`
                            });
                        }
                    }
                }

                // Create groups with delay
                if (boardOp.groups && boardOp.groups.length > 0) {
                    results.groups = [];
                    for (const group of boardOp.groups) {
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay
                            const groupQuery = `
                                mutation {
                                    create_group(
                                        board_id: ${boardId}
                                        group_name: "${group.name}"
                                    ) {
                                        id
                                        title
                                    }
                                }
                            `;
                            const groupData = await mondayRequest(groupQuery, req.headers.authorization);
                            results.groups.push(groupData.data.create_group);
                        } catch (groupError) {
                            console.error('Group creation error:', groupError);
                            results.groups.push({
                                error: `Failed to create group ${group.name}: ${groupError.message}`
                            });
                        }
                    }
                }

                // Create items with delay
                if (boardOp.items && boardOp.items.length > 0) {
                    results.items = [];
                    for (const item of boardOp.items) {
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1000)); // Add delay
                            
                            // Get the first group ID if available
                            const groupId = results.groups?.[0]?.id;
                            
                            // Prepare column values in the correct format
                            const columnValues = {};
                            if (item.columnValues) {
                                // Map column titles to their IDs
                                const columnsMap = results.columns.reduce((acc, col) => {
                                    acc[col.title.toLowerCase()] = col.id;
                                    return acc;
                                }, {});

                                // Build column values object
                                Object.entries(item.columnValues).forEach(([key, value]) => {
                                    const columnId = columnsMap[key.toLowerCase()];
                                    if (columnId) {
                                        columnValues[columnId] = value;
                                    }
                                });
                            }

                            const itemQuery = `
                                mutation {
                                    create_item(
                                        board_id: ${boardId}
                                        group_id: "${groupId}"
                                        item_name: "${item.name}"
                                        column_values: ${JSON.stringify(JSON.stringify(columnValues))}
                                    ) {
                                        id
                                        name
                                        group {
                                            id
                                        }
                                    }
                                }
                            `;
                            const itemData = await mondayRequest(itemQuery, req.headers.authorization);
                            results.items.push(itemData.data.create_item);
                        } catch (itemError) {
                            console.error('Item creation error:', itemError);
                            results.items.push({
                                error: `Failed to create item ${item.name}: ${itemError.message}`
                            });
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            results
        });

    } catch (error) {
        console.error('Batch operation error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            currentResults: results // Return partial results if any
        });
    }
});
