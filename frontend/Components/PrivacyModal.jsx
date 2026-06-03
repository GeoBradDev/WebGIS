import PropTypes from 'prop-types';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

const PrivacyModal = ({ open, onClose }) => (
    <Dialog open={open} onClose={onClose}>
        <DialogTitle>Privacy Policy</DialogTitle>
        <DialogContent>
            <Typography>
                {/* Add your Privacy Policy content here */}
                This is the privacy policy...
            </Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="primary">Close</Button>
        </DialogActions>
    </Dialog>
);

PrivacyModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default PrivacyModal;