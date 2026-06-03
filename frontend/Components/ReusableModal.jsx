import PropTypes from 'prop-types';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

const ReusableModal = ({ open, onClose, title, children, actions }) => (
    <Dialog open={open} onClose={onClose}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>{children}</DialogContent>
        <DialogActions>
            {actions}
            <Button onClick={onClose} color="primary">
                Close
            </Button>
        </DialogActions>
    </Dialog>
);

ReusableModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.node,
    children: PropTypes.node,
    actions: PropTypes.node,
};

export default ReusableModal;