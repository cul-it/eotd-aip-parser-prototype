# EoTD AIP Parser Prototype

A browser-based tool for parsing DSpace AIP (Archival Information Package) METS XML files. Extracts structured metadata from multiple embedded schemas and displays the results in an interactive table with cross-schema comparison.

## Schemas

The parser extracts data from three metadata schemas embedded within METS XML files:

- **[MODS](https://www.loc.gov/standards/mods/)** (Metadata Object Description Schema) - A Library of Congress standard for bibliographic metadata. Carried in `dmdSec` with `MDTYPE="MODS"`.
- **[DIM](https://wiki.lyrasis.org/display/DSDOC7x/Metadata+and+Bitstream+Format+Registries)** (DSpace Intermediate Metadata) - DSpace's internal representation of Dublin Core and extension schemas. Carried in `dmdSec` with `MDTYPE="OTHER" OTHERMDTYPE="DIM"`.
- **[METS](https://www.loc.gov/standards/mets/)** (Metadata Encoding and Transmission Standard) - The structural wrapper that contains file inventories, structural maps, and PREMIS preservation metadata.

## Field Mapping Across Schemas

The table below shows every field the parser extracts and which schema(s) provide it. Fields with multiple sources are compared for discrepancies using exact string matching.

| Field                      | MODS                                               | DIM                                                      | METS                                           |
|----------------------------|----------------------------------------------------|----------------------------------------------------------|------------------------------------------------|
| DOI                        | `mods:identifier[@type='doi']`                     | `dc.identifier.doi`                                      |                                                |
| Handle URL                 | `mods:identifier[@type='uri']`                     | `dc.identifier.uri`                                      |                                                |
| Instance HRID              | `mods:identifier[@type='local']` (bibid: prefix)   |                                                          |                                                |
| Title                      | `mods:titleInfo/mods:title`                        | `dc.title`                                               |                                                |
| Abstract                   | `mods:abstract`                                    | `dc.description.abstract`                                |                                                |
| Author                     | `mods:name[role='author']/mods:namePart`           | `dc.contributor.author`                                  |                                                |
| Committee Members          |                                                    | `dc.contributor.chair`, `dc.contributor.committeeMember` |                                                |
| Community                  |                                                    |                                                          | `structMap[@LABEL='Parent']//mptr/@xlink:href` |
| Collection                 |                                                    | `cris.virtual.collection`                                |                                                |
| Keywords                   | `mods:subject/mods:topic`                          | `dc.subject`                                             |                                                |
| Date Published             | `mods:originInfo/mods:dateIssued`                  | `dc.date.issued`                                         |                                                |
| Date Added to eCommons     | `mods:extension/mods:dateAccessioned`              | `dc.date.accessioned`                                    |                                                |
| Content Files / Bitstreams |                                                    |                                                          | `fileSec/fileGrp/file` + PREMIS                |
| License                    | `mods:accessCondition[@type='useAndReproduction']` | `dc.rights`                                              |                                                |
| Embargo                    |                                                    | `dc.description.embargo`                                 |                                                |
| Redaction                  |                                                    | `dc.description.provenance` (keyword match)              |                                                |

## Running

```bash
bun install
bun run dev
```

Open http://localhost:5173 and load a METS XML file.
