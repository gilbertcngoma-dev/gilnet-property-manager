# GILNET PROPERTY MANAGER

Build a Lodge Property Management web app for computer:

Database tables in Supabase:

- rooms: id, room_no, room_type (Standard/Deluxe/Suite), status (Vacant/Occupied/Cleaning), floor

- stays: id, guest_name, check_in (date), check_out (date), room_no, rate_per_night, laundry_cost, amount_paid, payment_method

Live calculations (must be live in app):

- nights = check_out - check_in

- room_revenue = nights * rate_per_night

- total_revenue = room_revenue + laundry_cost

- balance = total_revenue - amount_paid

Pages:

1. Dashboard: occupancy % (vacant vs occupied rooms), total revenue this month, balances owed, today's check-ins/check-outs

2. Front-Desk: Form to add new guest stay, auto-calculate nights/revenue, mark room occupied, list of current guests

3. Rooms: Grid view of all rooms with colors: green=vacant, red=occupied, yellow=cleaning

4. Reports: Revenue by room type, payment breakdown (Cash/Airtel/ Bank), laundry income

Tech: React + Tailwind + Supabase. Keep it simple for Zambian lodge.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gilnet-property-manager.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f120beaf-fbf5-4f57-a652-3dbb1ade90b3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
