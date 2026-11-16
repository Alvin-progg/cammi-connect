# Recommended Starting Prices (Synthetic)

For PAY-001 / PAY-01 seed data. **These are recommendations for the demo, not the
hospital's official rates.** The hospital's billing office must replace them before go-live,
and each doctor sets their own consultation fee.

## How the numbers were picked

- United Doctors of St. Camillus De Lellis Hospital is a provincial private hospital in
  Mabini, Batangas, so prices sit **near the middle of Batangas market ranges**, below
  Metro Manila tertiary hospitals.
- Reference: Metro Manila private specialist consults run about ₱700–₱1,500; provincial
  private hospitals about ₱400–₱1,000. Batangas lab prices: CBC ₱200–₱350, urinalysis
  ₱100–₱200, ECG ₱300–₱600, chest X-ray ₱300–₱800 (sources below).
- Prices end in round numbers so the 20% senior/PWD discount gives clean amounts
  (₱500 → ₱400).
- Packages are cheaper than buying each test separately, which is normal in the market.

## Consultations (doctor's professional fee)

Stored as the specialty default; a doctor can override it.

| Specialty | Recommended | Market range | Senior/PWD pays |
|---|---|---|---|
| Family Medicine | ₱400 | ₱300–₱600 | ₱320 |
| Internal Medicine | ₱500 | ₱400–₱800 | ₱400 |
| Pediatrics | ₱500 | ₱400–₱800 | ₱400 |
| Cardiology | ₱700 | ₱500–₱1,000 | ₱560 |
| *OB-Gynecology (if added)* | ₱600 | ₱400–₱1,000 | ₱480 |
| *Surgery (if added)* | ₱600 | ₱400–₱1,000 | ₱480 |

Optional rule for later: follow-up with the same doctor within 14 days at ₱300.

## Laboratory (`walk_in`)

| Service | Recommended | Batangas range | Requirements to show |
|---|---|---|---|
| CBC with platelet count | ₱250 | ₱200–₱350 | Doctor's request |
| Urinalysis | ₱120 | ₱100–₱200 | Clean-catch midstream sample |
| Fecalysis | ₱100 | ₱80–₱200 | Stool sample container from the lab |
| Fasting blood sugar (FBS) | ₱150 | ₱100–₱300 | 8–10 hours fasting |
| Lipid profile | ₱700 | ₱400–₱1,200 | 10–12 hours fasting |
| HbA1c | ₱550 | ₱400–₱700 | Doctor's request |
| Thyroid profile (T3, T4, TSH) | ₱950 | ₱700–₱1,200 | Doctor's request |

## Imaging and diagnostics

| Service | Mode | Recommended | Batangas range | Requirements to show |
|---|---|---|---|---|
| Chest X-ray (PA) | `walk_in` | ₱400 | ₱300–₱600 | Remove metal items |
| Chest X-ray (PA + lateral) | `walk_in` | ₱650 | ₱500–₱800 | Remove metal items |
| ECG (12-lead) | `walk_in` | ₱400 | ₱300–₱600 | — |
| Whole abdomen ultrasound | `scheduled` (30 min, 1 per slot) | ₱1,500 | ₱800–₱1,800 | 6–8 hours fasting |
| Pelvic ultrasound | `scheduled` (30 min, 1 per slot) | ₱1,000 | ₱800–₱1,800 | Full bladder |
| 2D echocardiogram | `scheduled` (45 min, 1 per slot) | ₱3,000 | ₱2,500–₱4,500 | Doctor's request |
| CT scan, single region, plain | `scheduled` (30 min, 1 per slot) | ₱6,000 | ₱4,500–₱8,000 | Doctor's request |

## Packages (`walk_in`)

| Package | Includes | À la carte | Recommended |
|---|---|---|---|
| Basic Health Check | CBC, urinalysis, FBS, chest X-ray (PA), ECG | ₱1,320 | **₱1,100** |
| Pre-employment | CBC, urinalysis, fecalysis, chest X-ray (PA), physical exam | ₱870 + PE | **₱650** |

## Not bookable or payable in chat

| Service | Why |
|---|---|
| Emergency room | RA 10932: no deposit or advance payment for emergencies |
| Pharmacy | Needs a prescription; paid at the pharmacy |
| Admission / surgery | Inpatient billing is out of scope |

## Coverage defaults for the seed

| Setting | Seed value | Why |
|---|---|---|
| PhilHealth benefit per service | ₱0 | Outpatient consults and labs are covered only at YAKAP-accredited providers for registered members; set it when the hospital confirms (decision D7) |
| HMO-coverable | Yes for consults, labs, imaging; no for packages | Most HMO plans exclude elective check-up packages |
| HMOs (synthetic list) | Maxicare, Intellicare, MediCard, PhilCare | Common Philippine HMOs; replace with the hospital's accredited list |
| VAT-able | No for everything | Hospital medical services are generally VAT-exempt; the accountant flags any exception |

## Discount examples (for the chat summary card)

| Case | Price | 20% | PhilHealth | Patient pays |
|---|---|---|---|---|
| Senior, Internal Medicine consult | ₱500 | −₱100 | — | **₱400** |
| PWD, CBC + urinalysis + FBS | ₱520 | −₱104 | — | **₱416** |
| Senior, whole abdomen ultrasound, ₱500 PhilHealth benefit | ₱1,500 | −₱300 | −₱500 | **₱700** |
| HMO member, Cardiology consult | ₱700 | — | — | **₱0** (HMO pays after LOA) |

## Sources

- [Batangas clinical laboratory price list 2026 (ClinicFinderPH)](https://www.clinicfinderph.com/blog/batangas-clinical-laboratory-price-list)
- [Manila Doctors Hospital rates, Metro Manila consult ranges (ClinicFinderPH)](https://www.clinicfinderph.com/blog/manila-doctors-hospital-rates-fees)
- [PGH laboratory price list (government reference)](https://www.clinicfinderph.com/blog/pgh-laboratory-price-list)
- [Annual physical exam package prices (ClinicFinderPH)](https://www.clinicfinderph.com/blog/annual-physical-exam-cost-philippines)
- [PhilHealth: order of deductions](https://www.philhealth.gov.ph/news/2023/seniorpwd_discounts.pdf)
