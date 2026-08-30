export const orderStatusColor = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'default',
};

export const paymentStatusColor = {
    pending_review: 'warning',
    paid: 'success',
    partially_paid: 'warning',
    unpaid: 'error',
    rejected: 'error',
};

export const paymentLabels = {
    pending_review: 'Awaiting review',
    paid: 'Confirmed',
    partially_paid: 'Partially paid',
    unpaid: 'Credit outstanding',
    rejected: 'Rejected',
};

export const orderStatusLabels = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

export const fulfillmentSteps = ['pending', 'processing', 'shipped', 'delivered'];
