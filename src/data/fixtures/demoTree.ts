/**
 * demoTree — a dev-only example asset tree, minted on demand from the console
 * (`window.__mintDemoTree()`, registered in `sync/devTools.ts`).
 *
 * **Not pack content, deliberately.** A pack ships Definitions and the bindings
 * that point at them; example *assets* are a different thing entirely, and the
 * day a pack arrives from an org or an upload it must not be able to write rows
 * into somebody's asset tree. Keeping the fixture here is what makes that
 * separation structural rather than a rule to remember.
 *
 * Everything is minted **through the command bus**, so it exercises exactly what
 * the UI exercises: `CREATE_ELEMENT` provisions the Jobs/Logbook lenses and
 * stamps the logbook policy, `CREATE_ELEMENT_FROM_DEFINITION` snapshots each
 * Definition's label onto its field. Jobs and log entries parent to the owning
 * *node*, not to the lens — the lens is a pure view that gathers them back
 * (`LensCreate.tsx` mints the same way).
 *
 * Ids are deterministic (`demo_*`), so a second run would collide rather than
 * duplicate; the existence check up front turns that into a clean no-op.
 * Demo rows DO enqueue sync, which is correct — they are ordinary user-shaped
 * data, and a dev session runs against the emulator.
 *
 * The values reference the bundled pack's Definitions by id. A pack that dropped
 * one of them would simply skip that field (the command throws not-found, which
 * is why each field is minted independently rather than in a batch).
 */

import { getCommandBus } from '../commands';
import { db } from '../storage/db';
import { DEFINITION_IDS } from '../definitionIds';
import type { DataFieldValue, Kind } from '../models';

/** One field to mint: the Definition it instantiates and the value it lands with. */
type DemoField = { definitionId: string; value: DataFieldValue };

type DemoNode = {
    id: string;
    name: string;
    subtitle?: string;
    kind?: Kind;
    fields?: DemoField[];
    /** Job names — minted as `job` children of this node, gathered by its Jobs lens. */
    jobs?: string[];
    /** Log entry names — minted as `log-entry` children, gathered by its Logbook lens. */
    entries?: string[];
    children?: DemoNode[];
};

const f = (definitionId: string, value: DataFieldValue): DemoField => ({ definitionId, value });

const DEMO_TREE: DemoNode[] = [
    {
        id: 'demo_workshop',
        name: 'Workshop & Utilities',
        subtitle: 'General industrial plant',
        children: [
            {
                id: 'demo_air_compressor',
                name: 'Air Compressor',
                subtitle: 'Atlas Copco GA22',
                fields: [
                    f(DEFINITION_IDS.typeOf, 'Rotary Screw'),
                    f(DEFINITION_IDS.status, 'In Service'),
                    f('fd_criticality', 'High'),
                    f('fd_hours_reading', 12450),
                    f('fd_operating_pressure', 8.5),
                    f('fd_oil_capacity', 2.4),
                    f('fd_filter_part_number', 'AF-2251'),
                    f('fd_service_interval', 500),
                    f('fd_last_service_date', '2026-07-02'),
                    f('fd_safety_notes', 'Isolate and drain the receiver before opening any line.'),
                ],
                jobs: ['Replace intake filter'],
                entries: ['Drained condensate', 'Oil change at 12,400 h'],
            },
            {
                id: 'demo_backup_generator',
                name: 'Backup Generator',
                subtitle: 'Standby power, workshop board',
                fields: [
                    f(DEFINITION_IDS.status, 'In Service'),
                    f('fd_fuel_type', 'Diesel'),
                    f(DEFINITION_IDS.powerRating, 45000),
                    f('fd_hours_reading', 322.5),
                    f('fd_supplier', 'Nordvik Power Services'),
                ],
                entries: ['Monthly test run OK'],
            },
        ],
    },
    {
        id: 'demo_production_line',
        name: 'Production Line',
        subtitle: 'Bottling line 2',
        children: [
            {
                id: 'demo_conveyor_1',
                name: 'Conveyor 1',
                subtitle: 'Infeed belt',
                fields: [
                    f(DEFINITION_IDS.status, 'In Service'),
                    f('fd_condition', 'Fair'),
                    f('fd_criticality', 'Critical'),
                    f('fd_lubricant_type', 'Lithium EP2'),
                    f('fd_service_interval', 250),
                ],
                jobs: ['Track belt drift'],
                children: [
                    {
                        id: 'demo_drive_motor',
                        name: 'Drive Motor',
                        subtitle: 'Head-end gearmotor',
                        fields: [
                            f('fd_manufacturer', 'WEG'),
                            f('fd_model', 'W22'),
                            f(DEFINITION_IDS.powerRating, 7500),
                            f('fd_serial_number', 'WEG-7745-2219'),
                        ],
                    },
                ],
            },
            {
                id: 'demo_filling_machine',
                name: 'Filling Machine',
                subtitle: 'Six-head volumetric filler',
                fields: [
                    f(DEFINITION_IDS.status, 'Maintenance'),
                    f('fd_condition', 'Poor'),
                    f('fd_note', 'Down until the seal kit arrives — line 2 running at half rate.'),
                    f('fd_supplier', 'Prosolt Packaging'),
                ],
                entries: ['Seal leak found on line 2'],
            },
        ],
    },
    {
        id: 'demo_farm_machinery',
        name: 'Farm Machinery',
        subtitle: 'Home farm, north yard',
        children: [
            {
                id: 'demo_tractor',
                name: 'Tractor — John Deere 6120M',
                subtitle: 'Yard and loader work',
                fields: [
                    f('fd_hours_reading', 3841.2),
                    f('fd_fuel_type', 'Diesel'),
                    f('fd_tire_pressure', 24),
                    f('fd_oil_capacity', 19.5),
                    f('fd_grease_points', 'Front axle pivot — weekly\nLoader pins — every 50 h\nPTO shaft — every 50 h'),
                    f('fd_last_service_date', '2026-05-18'),
                    f('fd_criticality', 'High'),
                ],
                jobs: ['600 h service due'],
                entries: ['Greased front axle', 'Replaced fuel filter'],
                children: [
                    {
                        id: 'demo_front_loader',
                        name: 'Front Loader',
                        subtitle: 'JD 623R',
                        fields: [
                            f('fd_part_number', '623R-AL'),
                            f('fd_condition', 'Good'),
                            f('fd_grease_points', 'Boom pivots and bucket pins — every 10 h'),
                        ],
                    },
                ],
            },
            {
                id: 'demo_grain_auger',
                name: 'Grain Auger',
                subtitle: '8 in x 41 ft, PTO drive',
                fields: [
                    f('fd_condition', 'Good'),
                    f('fd_safety_notes', 'Check the intake guard and driveline shield before every use.'),
                    f('fd_lubricant_type', 'SAE 90 gear oil'),
                ],
            },
        ],
    },
];

/** The row whose presence means the tree is already here. */
const SENTINEL_ID = DEMO_TREE[0].id;

async function mintNode(node: DemoNode, parentId: string | null, siblingOrder?: number): Promise<number> {
    const bus = getCommandBus();
    await bus.execute({
        type: 'CREATE_ELEMENT',
        payload: {
            id: node.id,
            kind: node.kind ?? 'node',
            parentId,
            name: node.name,
            subtitle: node.subtitle ?? null,
            siblingOrder,
        },
    });
    let minted = 1;

    let order = 0;
    for (const field of node.fields ?? []) {
        await bus.execute({
            type: 'CREATE_ELEMENT_FROM_DEFINITION',
            payload: {
                id: `${node.id}::f::${field.definitionId}`,
                parentId: node.id,
                definitionId: field.definitionId,
                initialValue: field.value,
                siblingOrder: order++,
            },
        });
        minted += 1;
    }

    // Records parent to the node, never to the lens — the lens gathers them.
    // No explicit `siblingOrder` for the node-like children: the two provisioned
    // lenses already hold the first slots of that section, so the adapter's
    // append (`nextSiblingOrder`) is the only thing that lands them after it —
    // and it is what the UI's own create paths do.
    let recordIndex = 0;
    for (const name of node.jobs ?? []) {
        await bus.execute({
            type: 'CREATE_ELEMENT',
            payload: { id: `${node.id}::job::${recordIndex++}`, kind: 'job', parentId: node.id, name },
        });
        minted += 1;
    }
    recordIndex = 0;
    for (const name of node.entries ?? []) {
        await bus.execute({
            type: 'CREATE_ELEMENT',
            payload: { id: `${node.id}::entry::${recordIndex++}`, kind: 'log-entry', parentId: node.id, name },
        });
        minted += 1;
    }

    for (const child of node.children ?? []) {
        minted += await mintNode(child, node.id);
    }
    return minted;
}

/**
 * Mint the demo tree, or report that it is already there. Idempotent by
 * existence check rather than by upsert: re-minting over edited demo rows would
 * silently undo whoever was poking at them.
 */
export async function mintDemoTree(): Promise<string> {
    const existing = await db.elements.get(SENTINEL_ID);
    if (existing) return 'Demo tree already minted — run __wipeLocal() to re-mint';

    let minted = 0;
    let rootOrder = 0;
    for (const root of DEMO_TREE) {
        minted += await mintNode(root, null, rootOrder++);
    }
    return `Demo tree minted — ${minted} Elements (plus their provisioned lenses)`;
}
