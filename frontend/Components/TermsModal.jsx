import PropTypes from 'prop-types';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

const TermsModal = ({ open, onClose }) => (
    <Dialog open={open} onClose={onClose}>
        <DialogTitle>Terms of Service</DialogTitle>
        <DialogContent>
            <Typography>
                {/* Add your Terms of Service content here */}
                These are the terms of service...
            </Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="primary">Close</Button>
        </DialogActions>
    </Dialog>
);

TermsModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default TermsModal;