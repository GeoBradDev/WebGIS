import {  useMemo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { DataGrid, GridToolbar } from '@mui/x-data-grid';
import useStore from '../src/store/useStore';

const CollapsibleTable = () => {
    const geojsonData = useStore((state) => state.geojsonData);
    const isTableCollapsed = useStore((state) => state.isTableCollapsed);
    const toggleTable = useStore((state) => state.toggleTable);

    // Transform GeoJSON features into rows using useMemo to memoize rows calculation
    const rows = useMemo(() => {
        return (
            geojsonData?.features?.map((feature) => ({
                id: feature.properties.OBJECTID,
                ...feature.properties,
            })) || []
        );
    }, [geojsonData]);

    // Define columns for the DataGrid
    const columns = useMemo(
        () => [
            { field: 'OBJECTID', headerName: 'OBJECTID', flex: 1 },
            { field: 'MUNICIPALITY', headerName: 'Municipality', flex: 2 },
            { field: 'MUNI', headerName: 'MUNI Code', flex: 1 },
            { field: 'MUNICODE', headerName: 'Municipality Code', flex: 1 },
            { field: 'LABELTXT', headerName: 'Label Text', flex: 1, type: 'number' },
            { field: 'SQ_MILES', headerName: 'Square Miles', flex: 1, type: 'number' },
            {
                field: 'last_edited_date',
                headerName: 'Last Edited Date',
                flex: 2,
                type: 'date',
                valueGetter: (params) =>
                    params.value ? new Date(params.value).toLocaleDateString() : '',
            },
            { field: 'Shape__Area', headerName: 'Area', flex: 1, type: 'number' },
            { field: 'Shape__Length', headerName: 'Length', flex: 1, type: 'number' },
        ],
        []
    );

    return (
        <Box
            sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Toggle Button */}
            <Box
                sx={{
                    alignSelf: 'flex-end',
                    margin: 1,
                    marginBottom: 3,
                }}
            >
                <Button variant="contained" onClick={toggleTable}>
                    {isTableCollapsed ? 'Show Table' : 'Hide Table'}
                </Button>
            </Box>

            {/* Collapsible Table */}
            {!isTableCollapsed && (
                <Box
                    sx={{
                        height: '70%',
                        width: '100%',
                        backgroundColor: 'white',
                        boxShadow: 3,
                        borderRadius: 1,
                        overflow: 'hidden',
                        zIndex: 10,
                    }}
                >
                    <Typography variant="h6" sx={{ padding: 1 }}>
                        Attribute Table
                    </Typography>
                    {rows.length > 0 ? (
                        <Box sx={{ height: 650, width: '100%' }}>
                            <DataGrid
                                rows={rows}
                                columns={columns}
                                loading={!geojsonData}
                                slots={{ toolbar: GridToolbar }}
                                initialState={{
                                    pagination: { paginationModel: { pageSize: 10 } },
                                }}
                                pageSizeOptions={[5, 10, 25]}
                            />
                        </Box>
                    ) : (
                        <Typography
                            variant="body1"
                            align="center"
                            sx={{ marginTop: 4 }}
                        >
                            No data available.
                        </Typography>
                    )}
                </Box>
            )}
        </Box>
    );
};

export default CollapsibleTable;
