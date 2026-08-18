import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/libs/mongodb";

import Order, {
  DHLStatus,
  InternationalStatus,
  OrderStatus,
} from "@/models/order";

import {
  PublicTrackingResult,
  TrackingEvent,
} from "@/types";

export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      trackingNumber: string;
    }>;
  }
) {
  try {
    await connectDB();

    const { trackingNumber } = await params;

    const normalizedTrackingNumber =
      trackingNumber.trim().toUpperCase();

    if (!normalizedTrackingNumber) {
      return NextResponse.json(
        {
          error:
            "Please provide a tracking number.",
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

    /* =========================================================
       NORMALIZE SERVICE TYPE
    ========================================================= */

    const serviceType = order.serviceType;

    const isDhlExpress =
      serviceType === "dhl_express";

    const isInternationalCargo =
      serviceType === "international";

    /* =========================================================
       NORMAL ORDER STATUS HISTORY
    ========================================================= */

    const statusHistory =
      (order.statusHistory ?? []).map(
        (h: {
          status: OrderStatus;
          at: Date;
        }) => ({
          status: h.status,
          at: h.at.toISOString(),
        })
      );

    /* =========================================================
       DHL STATUS HISTORY
    ========================================================= */

    const dhlStatusHistory =
      (order.dhlStatusHistory ?? []).map(
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

    /* =========================================================
       INTERNATIONAL CARGO STATUS HISTORY
    ========================================================= */

    const internationalStatusHistory =
      (
        order.internationalStatusHistory ??
        []
      ).map(
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

    /* =========================================================
       BUILD INTERNAL EVENTS
    ========================================================= */

    const internalEvents: TrackingEvent[] =
      statusHistory.map(
        (
          h: {
            status: OrderStatus;
            at: string;
          }
        ): TrackingEvent => ({
          status: h.status,
          at: h.at,
          source: "internal",
          description:
            getOrderStatusDescription(
              h.status
            ),
        })
      );

    /* =========================================================
       BUILD DHL EVENTS
    ========================================================= */

    const dhlEvents: TrackingEvent[] =
      dhlStatusHistory.map(
        (
          h: {
            status: DHLStatus;
            at: string;
            description?: string;
          }
        ): TrackingEvent => ({
          status: h.status,
          at: h.at,
          source: "dhl",
          description:
            h.description ||
            getDHLStatusDescription(
              h.status
            ),
        })
      );

    /* =========================================================
       BUILD INTERNATIONAL CARGO EVENTS
    ========================================================= */

    const internationalEvents: TrackingEvent[] =
      internationalStatusHistory.map(
        (
          h: {
            status: InternationalStatus;
            at: string;
            description?: string;
          }
        ): TrackingEvent => ({
          status: h.status,
          at: h.at,
          source: "international",
          description:
            h.description ||
            getInternationalStatusDescription(
              h.status
            ),
        })
      );

    /* =========================================================
       CUSTOMER-FACING TIMELINE
       
       DOMESTIC:
       Internal events only.

       DHL EXPRESS:
       Internal + DHL events.

       INTERNATIONAL CARGO:
       Internal + International events.
    ========================================================= */

    let trackingEvents: TrackingEvent[];

    if (isDhlExpress) {
      trackingEvents = [
        ...internalEvents,
        ...dhlEvents,
      ];
    } else if (isInternationalCargo) {
      trackingEvents = [
        ...internalEvents,
        ...internationalEvents,
      ];
    } else {
      trackingEvents = [
        ...internalEvents,
      ];
    }

    /* =========================================================
       SORT NEWEST FIRST
    ========================================================= */

    trackingEvents.sort(
      (a, b) =>
        new Date(b.at).getTime() -
        new Date(a.at).getTime()
    );

    /* =========================================================
       LOCATION HISTORY
    ========================================================= */

    const locationHistory =
      (order.locationHistory ?? []).map(
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
      );

    /* =========================================================
       LAST LOCATION
    ========================================================= */

    const lastLocation =
      order.lastLocation
        ? {
            lat: order.lastLocation.lat,
            lng: order.lastLocation.lng,
            updatedAt:
              order.lastLocation.updatedAt.toISOString(),
          }
        : null;

    /* =========================================================
       PUBLIC TRACKING RESULT
    ========================================================= */

    const result: PublicTrackingResult = {
      id: order._id.toString(),

      trackingNumber:
        order.trackingNumber,

      status:
        order.status as OrderStatus,

      /* -------------------------------------------------------
         NORMAL STATUS HISTORY
      ------------------------------------------------------- */

      statusHistory,

      /* -------------------------------------------------------
         DHL HISTORY
      ------------------------------------------------------- */

      dhlStatusHistory,

      /* -------------------------------------------------------
         INTERNATIONAL CARGO HISTORY
      ------------------------------------------------------- */

      internationalStatusHistory,

      /* -------------------------------------------------------
         CUSTOMER-FACING UNIFIED TIMELINE
      ------------------------------------------------------- */

      trackingEvents,

      /* -------------------------------------------------------
         EXTERNAL TRACKING INFORMATION
      ------------------------------------------------------- */

      externalTrackingNumber:
        order.externalTrackingNumber,

      carrierName:
        order.carrierName,

      /* -------------------------------------------------------
         SERVICE INFORMATION
      ------------------------------------------------------- */

      serviceType:
        order.serviceType,

      isInternational:
        Boolean(order.isInternational),

      /* -------------------------------------------------------
         PACKAGE INFORMATION
      ------------------------------------------------------- */

      packageDescription:
        order.packageDescription,

      recipientName:
        order.recipientName,

      pickupTime:
        order.pickupTime.toISOString(),

      eta:
        order.eta
          ? order.eta.toISOString()
          : undefined,

      /* -------------------------------------------------------
         PICKUP LOCATION
      ------------------------------------------------------- */

      pickup: {
        city:
          order.pickup.city,

        country:
          order.pickup.country,

        lat:
          order.pickup.lat,

        lng:
          order.pickup.lng,
      },

      /* -------------------------------------------------------
         DROPOFF LOCATION
      ------------------------------------------------------- */

      dropoff: {
        city:
          order.dropoff.city,

        country:
          order.dropoff.country,

        lat:
          order.dropoff.lat,

        lng:
          order.dropoff.lng,
      },

      /* -------------------------------------------------------
         LOCATION HISTORY
      ------------------------------------------------------- */

      locationHistory,

      /* -------------------------------------------------------
         LAST KNOWN LOCATION
      ------------------------------------------------------- */

      lastLocation,

      /* -------------------------------------------------------
         CREATED AT
      ------------------------------------------------------- */

      createdAt:
        order.createdAt.toISOString(),
    };

    return NextResponse.json(result, {
      status: 200,
    });
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

/* =========================================================
   INTERNAL ORDER STATUS DESCRIPTIONS
========================================================= */

function getOrderStatusDescription(
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
      "Shipment has arrived at its destination.",

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

/* =========================================================
   DHL STATUS DESCRIPTIONS
========================================================= */

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

  return (
    descriptions[status] ||
    "Shipment status updated."
  );
}

/* =========================================================
   INTERNATIONAL CARGO STATUS DESCRIPTIONS
========================================================= */

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

  return (
    descriptions[status] ||
    "International shipment status updated."
  );
}