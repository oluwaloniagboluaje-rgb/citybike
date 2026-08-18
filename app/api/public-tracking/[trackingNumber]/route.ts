import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/libs/mongodb";

import Order from "@/models/order";

import type {
  DHLStatus,
  InternationalStatus,
  OrderStatus,
} from "@/models/order";

import type {
  PublicTrackingResult,
  TrackingEvent,
} from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    await connectDB();

    const { trackingNumber } = await params;

    const normalizedTrackingNumber = trackingNumber
      .trim()
      .toUpperCase();

    if (!normalizedTrackingNumber) {
      return NextResponse.json(
        {
          error: "Please provide a tracking number.",
        },
        {
          status: 400,
        }
      );
    }

    const order = await Order.findOne({
      trackingNumber: normalizedTrackingNumber,
    }).lean();

    if (!order) {
      return NextResponse.json(
        {
          error:
            "No package found with that tracking number. Please check and try again.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * UNIFIED CUSTOMER TRACKING EVENTS
     * ---------------------------------------------------------
     */

    const trackingEvents: TrackingEvent[] = [];

    /*
     * ---------------------------------------------------------
     * INTERNAL STATUS HISTORY
     * ---------------------------------------------------------
     */

    if (order.statusHistory?.length) {
      trackingEvents.push(
        ...order.statusHistory.map(
          (h: {
            status: OrderStatus;
            at: Date;
          }) => ({
            status: h.status,
            at: h.at.toISOString(),
            description:
              getInternalStatusDescription(h.status),
            source: "internal" as const,
          })
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * DHL EXPRESS HISTORY
     * ---------------------------------------------------------
     */

    if (order.dhlStatusHistory?.length) {
      trackingEvents.push(
        ...order.dhlStatusHistory.map(
          (h: {
            status: DHLStatus;
            at: Date;
            description?: string;
          }) => ({
            status: h.status,
            at: h.at.toISOString(),
            description:
              h.description ||
              getDHLStatusDescription(h.status),
            source: "dhl" as const,
          })
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * INTERNATIONAL CARGO HISTORY
     * ---------------------------------------------------------
     */

    if (order.internationalStatusHistory?.length) {
      trackingEvents.push(
        ...order.internationalStatusHistory.map(
          (h: {
            status: InternationalStatus;
            at: Date;
            description?: string;
          }) => ({
            status: h.status,
            at: h.at.toISOString(),
            description:
              h.description ||
              getInternationalStatusDescription(
                h.status
              ),
            source: "international" as const,
          })
        )
      );
    }

    /*
     * ---------------------------------------------------------
     * SORT TRACKING EVENTS
     * ---------------------------------------------------------
     *
     * Newest event first.
     */

    trackingEvents.sort(
      (a, b) =>
        new Date(b.at).getTime() -
        new Date(a.at).getTime()
    );

    /*
     * ---------------------------------------------------------
     * DHL HISTORY FOR PUBLIC RESPONSE
     * ---------------------------------------------------------
     */

    const dhlStatusHistory =
      order.dhlStatusHistory?.map(
        (h: {
          status: DHLStatus;
          at: Date;
          description?: string;
        }) => ({
          status: h.status,
          at: h.at.toISOString(),
          description: h.description,
        })
      );

    /*
     * ---------------------------------------------------------
     * INTERNATIONAL HISTORY FOR PUBLIC RESPONSE
     * ---------------------------------------------------------
     */

    const internationalStatusHistory =
      order.internationalStatusHistory?.map(
        (h: {
          status: InternationalStatus;
          at: Date;
          description?: string;
        }) => ({
          status: h.status,
          at: h.at.toISOString(),
          description: h.description,
        })
      );

    /*
     * ---------------------------------------------------------
     * PUBLIC TRACKING RESPONSE
     * ---------------------------------------------------------
     */

    const result: PublicTrackingResult = {
      id: order._id.toString(),

      trackingNumber: order.trackingNumber,

      status: order.status as OrderStatus,

      /*
       * Normal CityBike status history.
       */
      statusHistory: order.statusHistory.map(
        (h: {
          status: OrderStatus;
          at: Date;
        }) => ({
          status: h.status,
          at: h.at.toISOString(),
        })
      ),

      /*
       * DHL Express history.
       */
      dhlStatusHistory,

      /*
       * International cargo history.
       */
      internationalStatusHistory,

      /*
       * Unified customer-facing timeline.
       */
      trackingEvents,

      /*
       * External carrier information.
       */
      externalTrackingNumber:
        order.externalTrackingNumber,

      carrierName: order.carrierName,

      /*
       * Shipment information.
       */
      serviceType: order.serviceType,

      isInternational:
        order.isInternational,

      packageDescription:
        order.packageDescription,

      recipientName:
        order.recipientName,

      pickupTime:
        order.pickupTime.toISOString(),

      eta:
        order.eta?.toISOString(),

      /*
       * Pickup location.
       */
      pickup: {
        city: order.pickup.city,
        country: order.pickup.country,
        lat: order.pickup.lat,
        lng: order.pickup.lng,
      },

      /*
       * Dropoff location.
       */
      dropoff: {
        city: order.dropoff.city,
        country: order.dropoff.country,
        lat: order.dropoff.lat,
        lng: order.dropoff.lng,
      },

      /*
       * Driver/location history.
       */
      locationHistory:
        order.locationHistory?.map(
          (point: {
            lat: number;
            lng: number;
            updatedAt: Date;
          }) => ({
            lat: point.lat,
            lng: point.lng,
            updatedAt:
              point.updatedAt.toISOString(),
          })
        ),

      /*
       * Current/latest location.
       */
      lastLocation: order.lastLocation
        ? {
            lat: order.lastLocation.lat,
            lng: order.lastLocation.lng,
            updatedAt:
              order.lastLocation.updatedAt.toISOString(),
          }
        : null,

      /*
       * Creation date.
       */
      createdAt:
        order.createdAt.toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Tracking API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to retrieve tracking information right now. Please try again later.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * ---------------------------------------------------------
 * INTERNAL STATUS DESCRIPTIONS
 * ---------------------------------------------------------
 */

function getInternalStatusDescription(
  status: OrderStatus
): string {
  const descriptions: Partial<
    Record<OrderStatus, string>
  > = {
    pending:
      "Shipment is pending.",

    shipment_created:
      "Shipment has been created.",

    awaiting_batching:
      "Shipment is awaiting batching.",

    added_to_batch:
      "Shipment has been added to a shipment batch.",

    ready_for_shipping:
      "Shipment is ready for shipping.",

    left_origin:
      "Shipment has left the origin.",

    in_transit:
      "Shipment is in transit.",

    landed:
      "Shipment has arrived at its destination country.",

    customs_processing:
      "Shipment is undergoing customs processing.",

    confirmed:
      "Shipment has been confirmed.",

    assigned:
      "Shipment has been assigned.",

    assigned_courier:
      "Shipment has been assigned to a courier.",

    picked_up:
      "Shipment has been picked up.",

    awaiting_dispatch:
      "Shipment is awaiting dispatch.",

    dispatched:
      "Shipment has been dispatched.",

    destination_hub:
      "Shipment has arrived at the destination hub.",

    out_for_delivery:
      "Shipment is out for delivery.",

    delivered_by_courier:
      "Shipment has been delivered by the courier.",

    delivery_confirmed:
      "Delivery has been confirmed.",

    delivered:
      "Shipment has been delivered.",

    cancelled:
      "Shipment has been cancelled.",
  };

  return (
    descriptions[status] ||
    "Shipment status updated."
  );
}

/*
 * ---------------------------------------------------------
 * DHL STATUS DESCRIPTIONS
 * ---------------------------------------------------------
 */

function getDHLStatusDescription(
  status: DHLStatus
): string {
  const descriptions: Record<
    DHLStatus,
    string
  > = {
    shipment_picked_up:
      "Shipment picked up.",

    in_transit:
      "Shipment is in transit.",

    out_for_delivery:
      "Shipment is out for delivery.",

    delivered:
      "Shipment has been delivered.",

    failed_delivery_attempt:
      "A delivery attempt was unsuccessful.",

    returned:
      "Shipment has been returned.",

    customs_cleared:
      "Shipment has cleared customs.",

    exception:
      "An exception has occurred with the shipment.",
  };

  return descriptions[status];
}

/*
 * ---------------------------------------------------------
 * INTERNATIONAL CARGO STATUS DESCRIPTIONS
 * ---------------------------------------------------------
 */

function getInternationalStatusDescription(
  status: InternationalStatus
): string {
  const descriptions: Record<
    InternationalStatus,
    string
  > = {
    shipment_picked_up:
      "International shipment picked up.",

    in_transit:
      "International shipment is in transit.",

    cleared_customs:
      "Shipment has cleared customs.",

    out_for_delivery:
      "Shipment is out for delivery.",

    delivered:
      "Shipment has been delivered.",

    delayed:
      "Shipment has been delayed.",

    exception:
      "An exception has occurred with the shipment.",
  };

  return descriptions[status];
}