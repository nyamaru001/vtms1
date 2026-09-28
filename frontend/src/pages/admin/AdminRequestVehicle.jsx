import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import LocationPicker from '../../components/LocationPicker';
import { requestsApi } from '../../services/resources';

export default function AdminRequestVehicle() {
  const navigate = useNavigate();
  const location = useLocation();

  // =====================================================
  // LOCATION SEARCH
  // =====================================================

  const [originText, setOriginText] = useState('');
  const [destinationTextValue, setDestinationTextValue] = useState('');

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);

  // =====================================================
  // FORM
  // =====================================================

  const [form, setForm] = useState({
    purpose: '',
    departureDate: '',
    departureTime: '',
    returnDate: '',
    returnTime: '',
    passengers: 1,
    additionalNotes: '',
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // =====================================================
  // UPDATE FORM
  // =====================================================

  const update = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));

    setError('');
  };

  // =====================================================
  // ORIGIN
  // =====================================================

  const handleOriginChange = (event) => {
    const value = event.target.value;

    setOriginText(value);

    // Remove old coordinates immediately.
    setOrigin(null);

    setError('');
  };

  // =====================================================
  // DESTINATION
  // =====================================================

  const handleDestinationChange = (event) => {
    const value = event.target.value;

    setDestinationTextValue(value);

    // Remove old coordinates immediately.
    setDestination(null);

    setError('');
  };

  // =====================================================
  // CLEAR LOCATIONS
  // =====================================================

  const clearLocations = () => {
    setOriginText('');
    setDestinationTextValue('');

    setOrigin(null);
    setDestination(null);

    setError('');
  };

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');

    // -----------------------------------------------------
    // ORIGIN
    // -----------------------------------------------------

    if (!originText.trim()) {
      setError(
        'Please enter the origin location.'
      );
      return;
    }

    if (!origin) {
      setError(
        'Origin location could not be found. Please wait for the map to locate it.'
      );
      return;
    }

    // -----------------------------------------------------
    // DESTINATION
    // -----------------------------------------------------

    if (!destinationTextValue.trim()) {
      setError(
        'Please enter the destination location.'
      );
      return;
    }

    if (!destination) {
      setError(
        'Destination location could not be found. Please wait for the map to locate it.'
      );
      return;
    }

    // -----------------------------------------------------
    // PURPOSE
    // -----------------------------------------------------

    if (!form.purpose.trim()) {
      setError(
        'Please enter the purpose of the trip.'
      );
      return;
    }

    // -----------------------------------------------------
    // DEPARTURE
    // -----------------------------------------------------

    if (!form.departureDate) {
      setError(
        'Please select the departure date.'
      );
      return;
    }

    if (!form.departureTime) {
      setError(
        'Please select the departure time.'
      );
      return;
    }

    // -----------------------------------------------------
    // RETURN DATE
    // -----------------------------------------------------

    if (
      form.returnDate &&
      form.returnDate < form.departureDate
    ) {
      setError(
        'Return date cannot be earlier than departure date.'
      );
      return;
    }

    // -----------------------------------------------------
    // RETURN TIME
    // -----------------------------------------------------

    if (
      form.returnDate &&
      !form.returnTime
    ) {
      setError(
        'Please select the return time.'
      );
      return;
    }

    // -----------------------------------------------------
    // PASSENGERS
    // -----------------------------------------------------

    const passengers = Number(
      form.passengers
    );

    if (
      !Number.isInteger(passengers) ||
      passengers < 1
    ) {
      setError(
        'Number of passengers must be at least 1.'
      );
      return;
    }

    if (passengers > 100) {
      setError(
        'Number of passengers cannot exceed 100.'
      );
      return;
    }

    // -----------------------------------------------------
    // SUBMIT
    // -----------------------------------------------------

    setSubmitting(true);

    try {
      const payload = {
        purpose:
          form.purpose.trim(),

        departureDate:
          form.departureDate,

        departureTime:
          form.departureTime,

        returnDate:
          form.returnDate || null,

        returnTime:
          form.returnTime || null,

        passengers,

        additionalNotes:
          form.additionalNotes.trim() ||
          null,

        // ORIGIN
        originName:
          origin.name ||
          originText.trim(),

        originLat:
          Number(origin.lat),

        originLng:
          Number(origin.lng),

        // DESTINATION
        destinationName:
          destination.name ||
          destinationTextValue.trim(),

        destinationLat:
          Number(destination.lat),

        destinationLng:
          Number(destination.lng),
      };

      const response =
        await requestsApi.create(
          payload
        );

      const request =
        response?.data ??
        response;

      if (!request?.id) {
        throw new Error(
          'Request was created but no request ID was returned.'
        );
      }

      navigate(
        `/admin/requests/${request.id}`
      );
    } catch (err) {
      console.error(
        'Vehicle request submission error:',
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Failed to submit vehicle request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="request-vehicle-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="request-page-header">

        <div>
          <span className="eyebrow">
            ADMIN PORTAL
          </span>

          <h1>
            Request Vehicle
          </h1>

          <p>
            Create a vehicle request using the standard workflow.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            navigate('/admin')
          }
          disabled={submitting}
        >
          ← Admin Dashboard
        </button>

      </div>

      {/* =================================================
          FORM CARD
      ================================================= */}

      <div className="request-form-card">

        <form
          onSubmit={handleSubmit}
          className="request-form"
        >

          {/* =================================================
              01 - TRIP INFORMATION
          ================================================= */}

          <section className="request-section">

            <div className="request-section-header">

              <div className="section-number">
                01
              </div>

              <div>
                <h2>
                  Trip Information
                </h2>

                <p>
                  Tell us why you need transport.
                </p>
              </div>

            </div>

            <div className="form-row">

              <label
                className="field-label"
                htmlFor="purpose"
              >
                Purpose of Trip
                <span className="required">
                  *
                </span>
              </label>

              <textarea
                id="purpose"
                className="input request-textarea"
                rows={2}
                value={form.purpose}
                onChange={update('purpose')}
                placeholder="Example: Official field visit to Dodoma..."
                required
              />

            </div>

          </section>

          {/* =================================================
              02 - TRIP ROUTE
          ================================================= */}

          <section className="request-section map-section">

            <div className="request-section-header">

              <div className="section-number">
                02
              </div>

              <div>
                <h2>
                  Trip Route
                </h2>

                <p>
                  Type the locations. The map will locate
                  them automatically.
                </p>
              </div>

            </div>

            {/* LOCATION INPUTS */}

            <div className="route-search-grid">

              {/* ORIGIN */}

              <div className="location-search-field">

                <label
                  className="field-label"
                  htmlFor="origin"
                >
                  Origin
                  <span className="required">
                    *
                  </span>
                </label>

                <div className="location-input-wrapper">

                  <span className="location-letter origin-letter">
                    A
                  </span>

                  <input
                    id="origin"
                    type="text"
                    className="input location-search-input"
                    value={originText}
                    onChange={
                      handleOriginChange
                    }
                    placeholder="e.g. UDOM, Dodoma"
                    autoComplete="off"
                    required
                  />

                </div>

              </div>

              {/* DESTINATION */}

              <div className="location-search-field">

                <label
                  className="field-label"
                  htmlFor="destination"
                >
                  Destination
                  <span className="required">
                    *
                  </span>
                </label>

                <div className="location-input-wrapper">

                  <span className="location-letter destination-letter">
                    B
                  </span>

                  <input
                    id="destination"
                    type="text"
                    className="input location-search-input"
                    value={
                      destinationTextValue
                    }
                    onChange={
                      handleDestinationChange
                    }
                    placeholder="e.g. Shinyanga Regional Hospital"
                    autoComplete="off"
                    required
                  />

                </div>

              </div>

            </div>

            {/* MAP */}

            <div className="location-map-wrapper">

              <LocationPicker
                originQuery={
                  originText
                }

                destinationQuery={
                  destinationTextValue
                }

                origin={origin}

                destination={
                  destination
                }

                onOriginChange={
                  setOrigin
                }

                onDestinationChange={
                  setDestination
                }

                height={360}

                showDistance
              />

            </div>

            {/* SELECTED LOCATIONS */}

            {(origin ||
              destination) && (
              <div className="selected-locations">

                <div
                  className={`location-summary ${
                    origin
                      ? 'selected'
                      : ''
                  }`}
                >

                  <div className="location-marker origin-marker">
                    A
                  </div>

                  <div className="location-summary-content">

                    <span>
                      Origin
                    </span>

                    <strong>
                      {origin?.name ||
                        'Searching...'}
                    </strong>

                  </div>

                </div>

                <div className="location-summary-arrow">
                  →
                </div>

                <div
                  className={`location-summary ${
                    destination
                      ? 'selected'
                      : ''
                  }`}
                >

                  <div className="location-marker destination-marker">
                    B
                  </div>

                  <div className="location-summary-content">

                    <span>
                      Destination
                    </span>

                    <strong>
                      {destination?.name ||
                        'Searching...'}
                    </strong>

                  </div>

                </div>

              </div>
            )}

            {/* CLEAR */}

            {(originText ||
              destinationTextValue) && (
              <button
                type="button"
                className="clear-route-btn"
                onClick={
                  clearLocations
                }
              >
                Clear locations
              </button>
            )}

          </section>

          {/* =================================================
              03 - SCHEDULE
          ================================================= */}

          <section className="request-section">

            <div className="request-section-header">

              <div className="section-number">
                03
              </div>

              <div>
                <h2>
                  Schedule
                </h2>

                <p>
                  When will the vehicle be required?
                </p>
              </div>

            </div>

            <div className="schedule-grid">

              <div className="form-row">

                <label
                  className="field-label"
                  htmlFor="departureDate"
                >
                  Departure Date
                  <span className="required">
                    *
                  </span>
                </label>

                <input
                  id="departureDate"
                  className="input"
                  type="date"
                  value={
                    form.departureDate
                  }
                  onChange={
                    update(
                      'departureDate'
                    )
                  }
                  required
                />

              </div>

              <div className="form-row">

                <label
                  className="field-label"
                  htmlFor="departureTime"
                >
                  Departure Time
                  <span className="required">
                    *
                  </span>
                </label>

                <input
                  id="departureTime"
                  className="input"
                  type="time"
                  value={
                    form.departureTime
                  }
                  onChange={
                    update(
                      'departureTime'
                    )
                  }
                  required
                />

              </div>

              <div className="form-row">

                <label
                  className="field-label"
                  htmlFor="returnDate"
                >
                  Return Date
                </label>

                <input
                  id="returnDate"
                  className="input"
                  type="date"
                  min={
                    form.departureDate ||
                    undefined
                  }
                  value={
                    form.returnDate
                  }
                  onChange={
                    update(
                      'returnDate'
                    )
                  }
                />

              </div>

              <div className="form-row">

                <label
                  className="field-label"
                  htmlFor="returnTime"
                >
                  Return Time
                </label>

                <input
                  id="returnTime"
                  className="input"
                  type="time"
                  value={
                    form.returnTime
                  }
                  onChange={
                    update(
                      'returnTime'
                    )
                  }
                />

              </div>

            </div>

          </section>

          {/* =================================================
              04 - PASSENGERS
          ================================================= */}

          <section className="request-section">

            <div className="request-section-header">

              <div className="section-number">
                04
              </div>

              <div>
                <h2>
                  Passengers
                </h2>

                <p>
                  Number of people travelling.
                </p>
              </div>

            </div>

            <div className="passenger-field">

              <label
                className="field-label"
                htmlFor="passengers"
              >
                Number of Passengers
                <span className="required">
                  *
                </span>
              </label>

              <input
                id="passengers"
                className="input passenger-input"
                type="number"
                min="1"
                max="100"
                value={
                  form.passengers
                }
                onChange={
                  update('passengers')
                }
                required
              />

            </div>

          </section>

          {/* =================================================
              05 - ADDITIONAL INFORMATION
          ================================================= */}

          <section className="request-section">

            <div className="request-section-header">

              <div className="section-number">
                05
              </div>

              <div>
                <h2>
                  Additional Information
                </h2>

                <p>
                  Optional information for the transport team.
                </p>
              </div>

            </div>

            <textarea
              id="additionalNotes"
              className="input request-textarea"
              rows={2}
              value={
                form.additionalNotes
              }
              onChange={
                update(
                  'additionalNotes'
                )
              }
              placeholder="Special requirements or additional information..."
            />

          </section>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div
              className="request-error"
              role="alert"
            >

              <span className="request-error-icon">
                !
              </span>

              <div>

                <strong>
                  Request could not be submitted
                </strong>

                <p>
                  {error}
                </p>

              </div>

            </div>
          )}

          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="request-form-actions">

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                navigate('/admin')
              }
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary submit-request-btn"
              disabled={submitting}
            >

              {submitting ? (
                <>
                  <span className="button-spinner" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Vehicle Request
                  <span>→</span>
                </>
              )}

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}