import { ShipmentForm } from '../components/ShipmentForm'
import './ShipmentPage.css'

export function ShipmentPage(props) {
  return (
    <main className="import-shipment-page">
      <ShipmentForm {...props} />
    </main>
  )
}
