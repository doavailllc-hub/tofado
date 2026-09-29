import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { Badge, Spinner, statusTone } from '../components/UI';

export default function WholesalerOrderDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api.get(`/wholesaler/orders/${id}`).then(response => {
      if (active) setData(response.data);
    }).catch(reason => {
      if (active) setError(reason.response?.data?.message || 'Unable to load this order. Please try again.');
    });
    return () => { active = false; };
  }, [id, attempt]);
  return <section style={{ padding: 24 }}>
    <Link to="/wholesaler/orders">Back to purchase orders</Link>
    <h1>Purchase order {data?.order.order_no || ''}</h1>
    {error ? <div role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button></div>
      : !data ? <Spinner /> : <>
        <Badge tone={statusTone(data.order.status)}>{data.order.status}</Badge>
        <h2>{data.order.retailer_name}</h2>
        <p>{data.order.delivery_address}</p>
        {data.order.notes && <p>{data.order.notes}</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderSpacing: '0 16px' }}>
            <caption>Requested products</caption>
            <thead><tr><th scope="col">Product</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Notes</th></tr></thead>
            <tbody>{data.items.map(item => <tr key={item.id}>
              <td>{item.product_name}</td><td>{item.quantity} {item.unit}</td>
              <td>{item.unit_price == null ? 'Awaiting quotation' : Number(item.unit_price).toFixed(2)}</td><td>{item.notes || '—'}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!data.items.length && <p>No items were found for this order.</p>}
        {data.invoice && <p><Link to={`/wholesaler/invoices/${data.invoice.id}`}>View invoice {data.invoice.invoice_no}</Link></p>}
        <p>Manage fulfilment status from the purchase orders list.</p>
      </>}
  </section>;
}
