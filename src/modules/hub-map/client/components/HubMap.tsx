import * as React from 'react'
import {
  Avatar,
  Select,
  StealthMode,
  WidgetWrapper,
} from '#client/components/ui'
import { useStore } from '@nanostores/react'
import * as stores from '#client/stores'
import { useOffice } from '#client/utils/hooks'
import dayjs from 'dayjs'
import { DaySlider } from '#client/components/ui/DaySlider'
import { DATE_FORMAT } from '#client/constants'
import { OfficeFloorMap } from '#client/components/OfficeFloorMap'
import { ScheduledItemsList } from './ScheduledItemsList'
import {
  useAvailableDesks,
  useOfficeVisitors,
  useToggleStealthMode,
  useVisitsAreas,
} from '#modules/visits/client/queries'
import { propEq } from '#shared/utils'
import { getPoints, goToMeetings, goToVisits } from '../helpers'
import { VisitType } from '#shared/types'
import { useUpcoming } from '../queries'
import { PermissionsValidator } from '#client/components/PermissionsValidator'
import Permissions from '#shared/permissions'

export const HubMap = () => {
  const officeId = useStore(stores.officeId)
  return (
    <PermissionsValidator
      officeId={officeId}
      required={[
        Permissions.visits.Create,
        Permissions['room-reservation'].Create,
        Permissions['guest-invites'].Create,
      ]}
    >
      <_HubMap />
    </PermissionsValidator>
  )
}

export const _HubMap = () => {
  const officeId = useStore(stores.officeId)
  const office = useOffice(officeId)
  const me = useStore(stores.me)

  const { data: areas = [] } = useVisitsAreas(office?.id || '', {
    enabled: office?.allowDeskReservation ?? false,
  })
  const [areaId, setAreaId] = React.useState<string | null>(null)
  const area = React.useMemo(() => areas.find((x) => areaId === x.id), [areaId])
  const [mappablePoints, setMappablePoints] = React.useState<any[]>([])

  const [date, setDate] = React.useState(dayjs())
  const [selectedDailyEvent, setSelectedDailyEvent] = React.useState<
    string | null
  >(null)

  const { data: upcomingVisitsAll, refetch: refetchVisits } = useUpcoming(
    officeId,
    dayjs().toString()
  )

  const { mutate: toggleStealthMode } = useToggleStealthMode(() => {
    refetchVisits()
    refetchVisitors()
  })
  const onToggleStealthMode = React.useCallback((value: boolean) => {
    toggleStealthMode({ stealthMode: value })
  }, [])

  React.useEffect(() => {
    setOfficeVisits(upcomingVisitsAll?.byDate[date.format(DATE_FORMAT)])
  }, [upcomingVisitsAll?.byDate, date])

  const [officeVisits, setOfficeVisits] = React.useState([])
  React.useEffect(() => {
    if (!!areas.length) {
      setAreaId(areas[0].id)
      setMappablePoints(getPoints(areas[0], office))
    }
  }, [areas])

  React.useEffect(() => {
    if (!!area) {
      setMappablePoints(getPoints(area, office))
    }
  }, [area])

  const onAreaChange = React.useCallback(
    (areaId: string) => setAreaId(areaId),
    []
  )

  const { data: visitors, refetch: refetchVisitors } = useOfficeVisitors(
    officeId,
    dayjs(date).format(DATE_FORMAT),
    !office?.allowDeskReservation
  )

  const userIsInOffce = React.useMemo(
    () => me && visitors?.some(propEq('userId', me.id)),
    [visitors, me]
  )
  const visitorsNumber = React.useMemo(() => visitors?.length || 0, [visitors])
  const [width, setWidth] = React.useState<number>(window.innerWidth)

  function handleWindowSizeChange() {
    setWidth(window.innerWidth)
  }
  React.useEffect(() => {
    window.addEventListener('resize', handleWindowSizeChange)
    return () => {
      window.removeEventListener('resize', handleWindowSizeChange)
    }
  }, [])

  const { data: availableDesks = [] } = useAvailableDesks(
    office?.id || '',
    office?.allowDeskReservation ? [date.format(DATE_FORMAT)] : []
  )

  const resetOfficeVisits = React.useCallback(() => {
    setOfficeVisits(upcomingVisitsAll.byDate[dayjs().format(DATE_FORMAT)] ?? [])
  }, [upcomingVisitsAll?.byDate])

  const availableAreaDeskIds = React.useMemo(() => {
    let available = []
    const desks = availableDesks
      .filter((x) => x.areaId === area?.id)
      .map((x) => x.deskId)

    available = [...desks]
    if (!!area?.meetingRooms) {
      available = [...available, ...area?.meetingRooms.map((x) => x.id)]
    }
    return available
  }, [availableDesks, area])

  const isMobile = width <= 480

  const inOfficeMessage = React.useMemo(() => {
    if (!visitorsNumber) {
      return `No one in the ${office?.name} hub`
    }

    if (userIsInOffce) {
      if (visitorsNumber === 1) {
        return `Only you in the ${office?.name} hub`
      } else {
        return `You and ${visitorsNumber - 1} others are in the ${
          office?.name
        } hub`
      }
    } else {
      return `${visitorsNumber} ${
        visitorsNumber === 1 ? 'person' : 'people'
      } in the ${office?.name} hub`
    }
  }, [office, visitorsNumber])

  if (!office?.allowDeskReservation) {
    return <></>
  }
  return (
    <WidgetWrapper className="transition-all delay-100">
      <div className="overflow-none">
        <ScheduledItemsList
          onChooseCard={(id, areaId, chosenDate) => {
            setSelectedDailyEvent(id)
            setAreaId(areaId)
            setDate(chosenDate)
            resetOfficeVisits()
          }}
          setDate={setDate}
          date={date}
          className={'mb-6'}
        />

        {area && (
          <div className="">
            <div>
              <div className="flex flex-col gap-4 sm:flex-row items-start sm:items-baseline justify-between mx-auto">
                <div className="w-full sm:w-auto flex flex-col  gap-4 items-start sm:items-baseline justify-center">
                  <DaySlider
                    onChange={(d) => {
                      setDate(d)
                    }}
                    reverse={true}
                    slideDate={date.format(DATE_FORMAT)}
                    className="mx-auto sm:mx-0"
                  />
                </div>
                <Select
                  label=""
                  options={areas.map((x) => ({
                    label: x.name,
                    value: x.id,
                  }))}
                  value={area?.id}
                  onChange={onAreaChange}
                  placeholder={'Select area'}
                  containerClassName="w-full sm:w-auto  mb-2 hidden sm:block"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 mt-6 sm:mt-2 items-start sm:items-center overflow-x-auto">
              <div className="flex flex-nowrap gap-4 overflow-x-auto">
                {!!visitors?.length &&
                  visitors.map((v) => {
                    return (
                      <button
                        key={v.userId}
                        className="hover:opacity-80 transition-all delay-100 w-8 h-8 shrink-0"
                        onClick={() => {
                          setSelectedDailyEvent(v.deskId)
                          setAreaId(v.areaId)
                          resetOfficeVisits()
                        }}
                      >
                        <Avatar
                          size="medium"
                          src={v.avatar}
                          userId={v.userId}
                        />
                      </button>
                    )
                  })}
              </div>
            </div>
            <div className="mt-2 text-text-tertiary mb-4 sm:mb-0">
              {inOfficeMessage}
            </div>
            <Select
              label=""
              options={areas.map((x) => ({
                label: x.name,
                value: x.id,
              }))}
              value={area?.id}
              onChange={onAreaChange}
              placeholder={'Select area'}
              containerClassName="w-full sm:w-auto  mb-2 block sm:hidden"
            />
            <div className="h-[400px] sm:h-auto m-auto my-auto sm:my-10">
              <OfficeFloorMap
                area={area}
                mappablePoints={mappablePoints}
                officeVisits={officeVisits}
                showUsers={true}
                selectedPointId={selectedDailyEvent}
                selectedAreaId={areaId}
                clickablePoints={availableAreaDeskIds}
                panZoom={isMobile}
                onToggle={(id, kind) => {
                  switch (kind) {
                    case VisitType.Visit:
                      return goToVisits(id, String(areaId), date)
                    case VisitType.RoomReservation:
                      return goToMeetings(id, date)
                    default:
                      return
                  }
                }}
              />
            </div>
            <div className="mt-10">
              <StealthMode
                originalValue={me?.stealthMode || false}
                onToggle={onToggleStealthMode}
                subtitle="Do not show me on this map"
              />
            </div>
          </div>
        )}
      </div>
    </WidgetWrapper>
  )
}
